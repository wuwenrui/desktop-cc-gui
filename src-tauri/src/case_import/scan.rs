//! 候选案件目录扫描：列父目录的一级子目录并统计文件概况。

use serde::Serialize;
use std::path::Path;

/// 递归统计文件数的上限（避免在超大目录上卡死）。
pub(crate) const MAX_COUNTED_FILES: usize = 500;

/// 一个候选案件目录的概况。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CandidateDir {
    pub path: String,
    pub name: String,
    /// 递归文件数（上限 [`MAX_COUNTED_FILES`]，达到上限即停止计数）
    pub file_count: usize,
    pub has_docx: bool,
    pub has_pdf: bool,
    /// 目录修改时间（RFC 3339），取不到为 None
    pub modified_at: Option<String>,
}

/// 列 `parent` 的一级子目录（跳过隐藏目录与符号链接），按名称排序。
pub(crate) fn scan_candidates(parent: &Path) -> Result<Vec<CandidateDir>, String> {
    if !parent.is_dir() {
        return Err(format!("目录不存在或不可访问: {}", parent.display()));
    }
    let reader = std::fs::read_dir(parent).map_err(|e| format!("读取目录失败: {e}"))?;

    let mut out = Vec::new();
    for entry in reader.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        // read_dir 的 file_type 不跟随符号链接，符号链接在此被识别并跳过。
        if file_type.is_symlink() || !file_type.is_dir() {
            continue;
        }
        let path = entry.path();
        let stats = count_files(&path, MAX_COUNTED_FILES);
        let modified_at = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
        out.push(CandidateDir {
            path: path.to_string_lossy().into_owned(),
            name,
            file_count: stats.file_count,
            has_docx: stats.has_docx,
            has_pdf: stats.has_pdf,
            modified_at,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

struct DirStats {
    file_count: usize,
    has_docx: bool,
    has_pdf: bool,
}

/// 递归统计目录内文件数与文档类型（跳过隐藏项与符号链接，计数到 `cap` 即止）。
fn count_files(dir: &Path, cap: usize) -> DirStats {
    let mut stats = DirStats {
        file_count: 0,
        has_docx: false,
        has_pdf: false,
    };
    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        if stats.file_count >= cap {
            break;
        }
        let Ok(reader) = std::fs::read_dir(&current) else {
            continue;
        };
        for entry in reader.flatten() {
            if stats.file_count >= cap {
                break;
            }
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
                stack.push(entry.path());
                continue;
            }
            stats.file_count += 1;
            let lower = name.to_lowercase();
            if lower.ends_with(".docx") {
                stats.has_docx = true;
            } else if lower.ends_with(".pdf") {
                stats.has_pdf = true;
            }
        }
    }
    stats
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("case_scan_test_{tag}_{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn lists_subdirs_with_file_stats_sorted_by_name() {
        let base = temp_dir("list");
        let case_b = base.join("乙案");
        let case_a = base.join("甲案");
        std::fs::create_dir_all(case_a.join("证据")).unwrap();
        std::fs::create_dir_all(&case_b).unwrap();
        std::fs::write(case_a.join("起诉状.docx"), b"x").unwrap();
        std::fs::write(case_a.join("证据").join("合同.pdf"), b"x").unwrap();
        std::fs::write(case_b.join("备注.txt"), b"x").unwrap();
        // 干扰项：文件与隐藏目录不应出现在候选里
        std::fs::write(base.join("散落文件.txt"), b"x").unwrap();
        std::fs::create_dir_all(base.join(".hidden")).unwrap();

        let out = scan_candidates(&base).unwrap();
        assert_eq!(
            out.iter().map(|c| c.name.as_str()).collect::<Vec<_>>(),
            vec!["乙案", "甲案"]
        );
        let jia = out.iter().find(|c| c.name == "甲案").unwrap();
        assert_eq!(jia.file_count, 2);
        assert!(jia.has_docx);
        assert!(jia.has_pdf);
        assert!(jia.modified_at.is_some());
        let yi = out.iter().find(|c| c.name == "乙案").unwrap();
        assert_eq!(yi.file_count, 1);
        assert!(!yi.has_docx);

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn skips_hidden_files_in_count() {
        let base = temp_dir("hidden");
        let case_dir = base.join("案件");
        std::fs::create_dir_all(&case_dir).unwrap();
        std::fs::write(case_dir.join(".DS_Store"), b"x").unwrap();
        std::fs::write(case_dir.join("a.txt"), b"x").unwrap();

        let out = scan_candidates(&base).unwrap();
        assert_eq!(out[0].file_count, 1);

        std::fs::remove_dir_all(&base).ok();
    }

    #[cfg(unix)]
    #[test]
    fn skips_symlinked_dirs() {
        let base = temp_dir("symlink");
        let real = base.join("真实案件");
        std::fs::create_dir_all(&real).unwrap();
        std::os::unix::fs::symlink(&real, base.join("链接案件")).unwrap();

        let out = scan_candidates(&base).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].name, "真实案件");

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn missing_parent_is_an_error() {
        let base = temp_dir("err");
        assert!(scan_candidates(&base.join("不存在")).is_err());
        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn count_files_respects_cap() {
        let base = temp_dir("cap");
        for i in 0..12 {
            std::fs::write(base.join(format!("f{i}.txt")), b"x").unwrap();
        }
        let stats = count_files(&base, 5);
        assert_eq!(stats.file_count, 5);
        std::fs::remove_dir_all(&base).ok();
    }
}
