//! 案件文件夹规则解析：从文书文本中抽取案号 / 当事人 / 案由 / 法院 / 阶段。
//!
//! 设计原则：
//! - 纯解析、零写入，每个字段带来源文件与置信度，让律师在确认界面核对。
//! - 不猜当事人立场：解析到的角色 + 名称原样返回，由律师指定我方/对方。
//! - 解析不出来就留空（None），宁缺毋滥。

use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::docx_text::extract_docx_text;

/// 单文件夹最多解析的文件数（超出即截断并在 notes 标注）。
pub(crate) const MAX_PARSE_FILES: usize = 200;
/// 遍历的最大目录深度（根目录下 3 层）。
pub(crate) const MAX_PARSE_DEPTH: usize = 3;
/// 单文件大小上限（10MB），超出跳过。
pub(crate) const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
/// 当事人最多解析条数。
const MAX_PARTIES: usize = 20;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum Confidence {
    High,
    Medium,
    Low,
}

/// 一个解析出的字段：值 + 来源文件 + 置信度。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FieldDraft {
    pub value: String,
    pub source_file: String,
    pub confidence: Confidence,
}

/// 一个解析出的当事人（角色原样保留，不猜我方/对方）。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PartyDraft {
    pub role: String,
    pub name: String,
    pub source_file: String,
}

/// 案件草稿：解析确认页的预填数据。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CaseDraft {
    pub title_suggestion: String,
    pub case_no: Option<FieldDraft>,
    pub cause_of_action: Option<FieldDraft>,
    pub court_name: Option<FieldDraft>,
    /// 阶段建议（CaseStage 枚举字符串，保守推断）
    pub stage_suggestion: String,
    pub stage_evidence: Vec<String>,
    pub parties: Vec<PartyDraft>,
    /// 实际解析了文本的文件（相对路径）
    pub scanned_files: Vec<String>,
    pub skipped_pdf_count: usize,
    pub notes: Vec<String>,
}

/// 一份已抽取文本的文档。
pub(crate) struct DocText {
    pub rel_path: String,
    pub text: String,
}

struct FolderScan {
    docs: Vec<DocText>,
    /// 所有可见文件的相对路径（含 PDF 等未解析文件，供阶段推断用文件名）
    all_files: Vec<String>,
    skipped_pdf_count: usize,
    notes: Vec<String>,
}

/// 解析一个案件文件夹（只读）。
pub(crate) fn parse_folder(dir: &Path) -> Result<CaseDraft, String> {
    let scan = collect_folder_scan(dir)?;
    let folder_name = dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();

    let case_no = parse_case_no(&scan.docs);
    let parties = parse_parties(&scan.docs);
    let cause_of_action = parse_cause(&scan.docs, &folder_name, &parties);
    let court_name = parse_court(&scan.docs);
    let (stage_suggestion, stage_evidence) =
        infer_stage(&scan.all_files, &scan.docs, case_no.is_some());
    let title_suggestion = build_title(&folder_name, &parties, cause_of_action.as_ref());

    Ok(CaseDraft {
        title_suggestion,
        case_no,
        cause_of_action,
        court_name,
        stage_suggestion,
        stage_evidence,
        parties,
        scanned_files: scan.docs.iter().map(|d| d.rel_path.clone()).collect(),
        skipped_pdf_count: scan.skipped_pdf_count,
        notes: scan.notes,
    })
}

/// 遍历文件夹收集文本：docx/txt/md 解析，PDF 计数跳过，其余只记文件名。
fn collect_folder_scan(root: &Path) -> Result<FolderScan, String> {
    if !root.is_dir() {
        return Err(format!("目录不存在或不可访问: {}", root.display()));
    }
    let mut docs = Vec::new();
    let mut all_files = Vec::new();
    let mut notes = Vec::new();
    let mut skipped_pdf = 0usize;
    let mut legacy_doc = 0usize;
    let mut oversized = 0usize;
    let mut decode_failures: Vec<String> = Vec::new();
    let mut visited = 0usize;
    let mut truncated = false;

    let mut stack: Vec<(PathBuf, usize)> = vec![(root.to_path_buf(), 0)];
    while let Some((dir, depth)) = stack.pop() {
        let Ok(reader) = std::fs::read_dir(&dir) else {
            continue;
        };
        let mut entries: Vec<_> = reader.flatten().collect();
        entries.sort_by_key(|e| e.file_name());
        for entry in entries {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if depth < MAX_PARSE_DEPTH {
                    stack.push((entry.path(), depth + 1));
                }
                continue;
            }
            if visited >= MAX_PARSE_FILES {
                truncated = true;
                continue;
            }
            visited += 1;

            let path = entry.path();
            let rel_path = path
                .strip_prefix(root)
                .map(|p| p.to_string_lossy().replace('\\', "/"))
                .unwrap_or_else(|_| name.clone());
            all_files.push(rel_path.clone());

            let lower = name.to_lowercase();
            if lower.ends_with(".pdf") {
                skipped_pdf += 1;
                continue;
            }
            if lower.ends_with(".doc") {
                legacy_doc += 1;
                continue;
            }
            let is_docx = lower.ends_with(".docx");
            let is_plain = lower.ends_with(".txt") || lower.ends_with(".md");
            if !is_docx && !is_plain {
                continue;
            }
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            if size > MAX_FILE_BYTES {
                oversized += 1;
                continue;
            }
            let Ok(bytes) = std::fs::read(&path) else {
                decode_failures.push(rel_path.clone());
                continue;
            };
            let text = if is_docx {
                extract_docx_text(&bytes)
            } else {
                // UTF-8 优先，失败用 chardetng 探测（覆盖 GBK/GB18030）
                crate::text_encoding::decode_text_bytes(&bytes, &rel_path)
            };
            match text {
                Ok(text) if !text.trim().is_empty() => docs.push(DocText { rel_path, text }),
                Ok(_) => {}
                Err(_) => decode_failures.push(rel_path.clone()),
            }
        }
    }

    if skipped_pdf > 0 {
        notes.push(format!(
            "{skipped_pdf} 个 PDF 文件未解析（本期不支持 PDF/扫描件文本提取）"
        ));
    }
    if legacy_doc > 0 {
        notes.push(format!("{legacy_doc} 个 .doc（旧版 Word）文件未解析"));
    }
    if oversized > 0 {
        notes.push(format!("{oversized} 个文件超过 10MB 已跳过"));
    }
    if truncated {
        notes.push(format!("文件数超过 {MAX_PARSE_FILES} 个，仅解析前 {MAX_PARSE_FILES} 个"));
    }
    if !decode_failures.is_empty() {
        let shown: Vec<&str> = decode_failures.iter().take(5).map(|s| s.as_str()).collect();
        notes.push(format!("无法读取文本: {}", shown.join("、")));
    }

    Ok(FolderScan {
        docs,
        all_files,
        skipped_pdf_count: skipped_pdf,
        notes,
    })
}

// ---- 案号 ----

/// 案号正则候选（新版 + 旧版字第格式），宽容空白与半角括号。
fn case_no_patterns() -> Vec<Regex> {
    vec![
        // 新版：（2023）京01民初123号 / （2023）粤0106民初12345号 / （2024）沪74执恢12号
        Regex::new(
            r"[（(]\s*20\d{2}\s*[)）]\s*[一-龥]{1,8}\s*\d{0,6}\s*(?:民初|民终|民再|民申|民监|民特|民辖|刑初|刑终|刑再|行初|行终|行赔|执恢|执异|执保|执|商初|商终|仲|破申|破|财保|赔)\s*\d{1,8}\s*号",
        )
        .expect("valid case-no regex"),
        // 旧版：（2015）朝民初字第12345号
        Regex::new(
            r"[（(]\s*20\d{2}\s*[)）]\s*[一-龥]{1,8}[民刑行执商仲][初终再审申执监保恢]?字?第?\s*\d{1,8}\s*号",
        )
        .expect("valid legacy case-no regex"),
    ]
}

fn normalize_case_no(raw: &str) -> String {
    raw.chars()
        .filter(|c| !c.is_whitespace())
        .map(|c| match c {
            '(' => '（',
            ')' => '）',
            other => other,
        })
        .collect()
}

/// 取全部文档中最高频的案号（同频取先出现者）。
fn parse_case_no(docs: &[DocText]) -> Option<FieldDraft> {
    let patterns = case_no_patterns();
    // (归一化案号, 次数, 首个来源文件)
    let mut counts: Vec<(String, usize, String)> = Vec::new();
    for doc in docs {
        for pattern in &patterns {
            for found in pattern.find_iter(&doc.text) {
                let normalized = normalize_case_no(found.as_str());
                match counts.iter_mut().find(|(v, _, _)| *v == normalized) {
                    Some(slot) => slot.1 += 1,
                    None => counts.push((normalized, 1, doc.rel_path.clone())),
                }
            }
        }
    }
    let best = counts.iter().max_by_key(|(_, count, _)| *count)?.clone();
    // max_by_key 同频返回最后一个；为保证“同频取先出现”，再按次数找第一个。
    let (value, count, source_file) = counts
        .into_iter()
        .find(|(_, count, _)| *count == best.1)
        .unwrap_or(best);
    Some(FieldDraft {
        value,
        source_file,
        confidence: if count >= 2 {
            Confidence::High
        } else {
            Confidence::Medium
        },
    })
}

// ---- 当事人 ----

/// 行首角色匹配：原告/被告/第三人/申请人/被申请人/上诉人/被上诉人/
/// 申请执行人/被执行人/委托人，长角色优先避免前缀误配。
fn party_pattern() -> Regex {
    Regex::new(
        r"(?m)^[\s　]*(申请执行人|被执行人|被申请人|被上诉人|上诉人|申请人|第三人|原告|被告|委托人)(?:[0-9一二三四五六七八九十]{0,2})?(?:[（(][^）)]{1,12}[）)])?[\s　]*[:：][\s　]*(.+)$",
    )
    .expect("valid party regex")
}

/// 清洗当事人名称：截断在第一个标点/空白处，名称 1..=30 字。
fn clean_party_name(raw: &str) -> Option<String> {
    let head = raw.trim();
    let cut = head
        .find(|c: char| "，,。；;：:、".contains(c) || c.is_whitespace())
        .map(|i| &head[..i])
        .unwrap_or(head);
    let name = cut.trim();
    let char_count = name.chars().count();
    if name.is_empty() || char_count > 30 {
        return None;
    }
    Some(name.to_string())
}

/// 解析当事人列表（同名去重，最多 [`MAX_PARTIES`] 条）。
fn parse_parties(docs: &[DocText]) -> Vec<PartyDraft> {
    let pattern = party_pattern();
    let mut seen: HashSet<String> = HashSet::new();
    let mut out = Vec::new();
    for doc in docs {
        for caps in pattern.captures_iter(&doc.text) {
            let role = caps[1].to_string();
            let Some(name) = clean_party_name(&caps[2]) else {
                continue;
            };
            if !seen.insert(name.clone()) {
                continue;
            }
            out.push(PartyDraft {
                role,
                name,
                source_file: doc.rel_path.clone(),
            });
            if out.len() >= MAX_PARTIES {
                return out;
            }
        }
    }
    out
}

// ---- 案由 ----

/// 案由解析，按置信度从高到低：
/// ① 文本「案由：……纠纷」 ② 「就/因……纠纷一案」 ③ 当事人名锚定「{name}……纠纷一案」
/// ④ 文件夹名（剥当事人前缀，保守）。
fn parse_cause(docs: &[DocText], folder_name: &str, parties: &[PartyDraft]) -> Option<FieldDraft> {
    let explicit =
        Regex::new(r"案由[\s　]*[:：]?[\s　]*([一-龥]{2,28}?(?:纠纷|罪))").expect("valid regex");
    for doc in docs {
        if let Some(caps) = explicit.captures(&doc.text) {
            return Some(FieldDraft {
                value: caps[1].to_string(),
                source_file: doc.rel_path.clone(),
                confidence: Confidence::High,
            });
        }
    }

    let yian = Regex::new(r"(?:就|因)([一-龥]{2,20}?(?:纠纷|罪))一案").expect("valid regex");
    for doc in docs {
        if let Some(caps) = yian.captures(&doc.text) {
            return Some(FieldDraft {
                value: caps[1].to_string(),
                source_file: doc.rel_path.clone(),
                confidence: Confidence::Medium,
            });
        }
    }

    for party in parties {
        let Ok(anchored) = Regex::new(&format!(
            "{}([一-龥]{{2,20}}?(?:纠纷|罪))一案",
            regex::escape(&party.name)
        )) else {
            continue;
        };
        for doc in docs {
            if let Some(caps) = anchored.captures(&doc.text) {
                return Some(FieldDraft {
                    value: caps[1].to_string(),
                    source_file: doc.rel_path.clone(),
                    confidence: Confidence::Medium,
                });
            }
        }
    }

    cause_from_folder_name(folder_name, parties).map(|value| FieldDraft {
        value,
        source_file: "文件夹名".to_string(),
        confidence: Confidence::Low,
    })
}

/// 从文件夹名提取案由（保守策略，避免把当事人名混进案由）：
/// - 取最后一个「诉/与」之后的部分，剥掉已解析的当事人名前缀后须形如「……纠纷/罪」；
/// - 无「诉/与」时仅接受 ≤8 字的纯案由段（如「合同纠纷」），避免误把长串当案由。
fn cause_from_folder_name(folder_name: &str, parties: &[PartyDraft]) -> Option<String> {
    let cjk_run = Regex::new(r"[一-龥]+").expect("valid regex");
    let tail = Regex::new(r"^[一-龥]{2,16}(?:纠纷|罪)$").expect("valid regex");
    let mut party_names: Vec<&str> = parties.iter().map(|p| p.name.as_str()).collect();
    // 最长优先，避免「张三」先剥导致「张三丰」剥不净
    party_names.sort_by_key(|n| std::cmp::Reverse(n.len()));

    for run in cjk_run.find_iter(folder_name) {
        let run = run.as_str();
        if let Some(pos) = run.rfind(['诉', '与']) {
            let mut rest = &run[pos + '诉'.len_utf8()..];
            let mut stripped = false;
            loop {
                let before = rest;
                for name in &party_names {
                    if !name.is_empty() && rest.starts_with(name) {
                        rest = &rest[name.len()..];
                        stripped = true;
                    }
                }
                if rest == before {
                    break;
                }
            }
            let within_limit = if stripped {
                true
            } else {
                rest.chars().count() <= 8
            };
            if within_limit && tail.is_match(rest) {
                return Some(rest.to_string());
            }
        } else if run.chars().count() <= 8 && tail.is_match(run) {
            return Some(run.to_string());
        }
    }
    None
}

// ---- 法院 ----

const COURT_SUFFIX: &str =
    r"(?:人民法院|海事法院|互联网法院|金融法院|知识产权法院|铁路运输法院)";

/// 行内匹配时剥离常见前导连接字（「经北京市……人民法院」→「北京市……人民法院」）。
const COURT_LEADING_NOISE: &[char] = &[
    '经', '由', '向', '至', '在', '并', '就', '于', '受', '系', '即', '往', '已', '均', '被',
    '请', '准', '与', '及', '或', '对', '本', '该', '依', '按', '为', '自', '从', '是', '到',
    '案', '诉', '现', '之', '的', '了', '等', '将', '曾', '亦', '又',
];

fn strip_court_noise(raw: &str) -> String {
    let mut rest = raw;
    loop {
        let Some(first) = rest.chars().next() else {
            break;
        };
        if COURT_LEADING_NOISE.contains(&first) && rest.chars().count() > 6 {
            rest = &rest[first.len_utf8()..];
        } else {
            break;
        }
    }
    rest.to_string()
}

/// 法院解析：整行独占的法院名（文书落款/抬头）优先且置信度高；
/// 否则行内匹配 + 前导噪音剥离，取最高频。
fn parse_court(docs: &[DocText]) -> Option<FieldDraft> {
    let line_anchored = Regex::new(&format!(r"(?m)^[\s　]*([一-龥]{{2,20}}{COURT_SUFFIX})[\s　]*$"))
        .expect("valid court regex");
    let inline = Regex::new(&format!(r"([一-龥]{{2,18}}{COURT_SUFFIX})"))
        .expect("valid inline court regex");

    let mut counts: Vec<(String, usize, String, Confidence)> = Vec::new();
    let mut bump = |value: String, source: &str, confidence: Confidence| {
        match counts.iter_mut().find(|(v, _, _, _)| *v == value) {
            Some(slot) => {
                slot.1 += 1;
                if confidence == Confidence::High {
                    slot.3 = Confidence::High;
                }
            }
            None => counts.push((value, 1, source.to_string(), confidence)),
        }
    };
    for doc in docs {
        for caps in line_anchored.captures_iter(&doc.text) {
            bump(caps[1].to_string(), &doc.rel_path, Confidence::High);
        }
        for caps in inline.captures_iter(&doc.text) {
            let cleaned = strip_court_noise(&caps[1]);
            if cleaned.chars().count() >= 5 {
                bump(cleaned, &doc.rel_path, Confidence::Medium);
            }
        }
    }
    // 高置信度（整行）优先，其次频次，同分取先出现。
    let best_key = counts
        .iter()
        .map(|(_, count, _, conf)| ((*conf == Confidence::High) as usize, *count))
        .max()?;
    counts
        .into_iter()
        .find(|(_, count, _, conf)| {
            ((*conf == Confidence::High) as usize, *count) == best_key
        })
        .map(|(value, _, source_file, confidence)| FieldDraft {
            value,
            source_file,
            confidence,
        })
}

// ---- 阶段推断 ----

/// 阶段关键词，按案件进程从后往前检查（执行 > 判决 > 已立案）。
/// 「执行裁定书」须先于「裁定书」判定，避免误归 judgment。
const STAGE_RULES: &[(&str, &[&str])] = &[
    (
        "enforcement",
        &["执行通知", "执行裁定", "恢复执行", "终结执行", "执行立案"],
    ),
    ("judgment", &["判决书", "裁定书"]),
    (
        "filed",
        &["受理通知", "缴费通知", "交费通知", "传票", "应诉通知", "举证通知"],
    ),
];

/// 保守推断阶段并给出证据；都不命中且无案号、无起诉状时回退 intake。
fn infer_stage(all_files: &[String], docs: &[DocText], has_case_no: bool) -> (String, Vec<String>) {
    for (stage, keywords) in STAGE_RULES {
        let mut evidence = Vec::new();
        for keyword in *keywords {
            for file in all_files {
                if file.contains(keyword) {
                    evidence.push(format!("文件名「{file}」含「{keyword}」"));
                }
            }
            for doc in docs {
                if doc.text.contains(keyword) {
                    evidence.push(format!("「{}」内容含「{keyword}」", doc.rel_path));
                }
            }
        }
        if !evidence.is_empty() {
            evidence.truncate(5);
            return ((*stage).to_string(), evidence);
        }
    }
    if has_case_no {
        return ("filed".to_string(), vec!["已解析到案号".to_string()]);
    }
    let complaint_file = all_files.iter().find(|f| f.contains("起诉状"));
    if let Some(file) = complaint_file {
        return (
            "filing_prep".to_string(),
            vec![format!("存在起诉状「{file}」但未解析到案号")],
        );
    }
    if let Some(doc) = docs.iter().find(|d| d.text.contains("起诉状")) {
        return (
            "filing_prep".to_string(),
            vec![format!("「{}」内容含「起诉状」但未解析到案号", doc.rel_path)],
        );
    }
    ("intake".to_string(), Vec::new())
}

// ---- 案件名建议 ----

/// 文件夹名含 ≥2 个汉字视为有信息量，直接用作案件名建议。
fn folder_name_is_informative(name: &str) -> bool {
    name.chars().filter(|c| ('一'..='龥').contains(c)).count() >= 2
}

/// 案件名建议：优先文件夹名；无信息量时拼「{当事人A}与{当事人B}{案由}」。
fn build_title(folder_name: &str, parties: &[PartyDraft], cause: Option<&FieldDraft>) -> String {
    let trimmed = folder_name.trim();
    if folder_name_is_informative(trimmed) {
        return trimmed.to_string();
    }
    let mut names = parties.iter().map(|p| p.name.as_str());
    if let (Some(first), Some(second)) = (names.next(), names.next()) {
        let cause_part = cause.map(|c| c.value.as_str()).unwrap_or("");
        return format!("{first}与{second}{cause_part}");
    }
    trimmed.to_string()
}

#[cfg(test)]
#[path = "parse_tests.rs"]
mod tests;
