//! parse.rs 的单元测试（拆分文件以控制单文件行数，经 #[path] 挂载为 parse 的子模块）。

    use super::*;
    use crate::case_import::docx_text::make_docx;

    fn doc(rel_path: &str, text: &str) -> DocText {
        DocText {
            rel_path: rel_path.to_string(),
            text: text.to_string(),
        }
    }

    const COMPLAINT_HEAD: &str = "民事起诉状\n原告：张三，男，1980年5月1日出生，汉族，住北京市朝阳区。\n被告：北京某某科技有限公司，住所地北京市海淀区。\n诉讼请求：\n一、判令被告偿还借款本金100万元；\n事实与理由：\n原告与被告民间借贷纠纷一案，……";

    const JUDGMENT_HEAD: &str = "北京市朝阳区人民法院\n民事判决书\n（2023）京0105民初12345号\n原告：张三。\n被告：北京某某科技有限公司。\n本院于2023年3月1日立案受理。\n北京市朝阳区人民法院\n二〇二三年九月一日";

    // ---- 案号 ----

    #[test]
    fn parses_modern_case_no() {
        let field = parse_case_no(&[doc("判决书.txt", JUDGMENT_HEAD)]).unwrap();
        assert_eq!(field.value, "（2023）京0105民初12345号");
        assert_eq!(field.source_file, "判决书.txt");
        assert_eq!(field.confidence, Confidence::Medium);
    }

    #[test]
    fn normalizes_halfwidth_parens_and_whitespace() {
        let field =
            parse_case_no(&[doc("a.txt", "本案案号为 (2024) 粤01 民终 567 号。")]).unwrap();
        assert_eq!(field.value, "（2024）粤01民终567号");
    }

    #[test]
    fn parses_legacy_case_no() {
        let field = parse_case_no(&[doc("a.txt", "（2015）朝民初字第6789号")]).unwrap();
        assert_eq!(field.value, "（2015）朝民初字第6789号");
    }

    #[test]
    fn picks_most_frequent_case_no_with_high_confidence() {
        let docs = vec![
            doc("a.txt", "（2023）京01民初111号 和 （2022）京01民初222号"),
            doc("b.txt", "（2023）京01民初111号"),
        ];
        let field = parse_case_no(&docs).unwrap();
        assert_eq!(field.value, "（2023）京01民初111号");
        assert_eq!(field.confidence, Confidence::High);
    }

    #[test]
    fn no_case_no_in_plain_text() {
        assert!(parse_case_no(&[doc("a.txt", "这是一份普通的会议记录（2023年）。")]).is_none());
    }

    #[test]
    fn parses_enforcement_case_no() {
        let field = parse_case_no(&[doc("a.txt", "（2024）沪74执恢12号")]).unwrap();
        assert_eq!(field.value, "（2024）沪74执恢12号");
    }

    // ---- 当事人 ----

    #[test]
    fn parses_parties_from_complaint_head() {
        let parties = parse_parties(&[doc("起诉状.docx", COMPLAINT_HEAD)]);
        assert_eq!(parties.len(), 2);
        assert_eq!(parties[0].role, "原告");
        assert_eq!(parties[0].name, "张三");
        assert_eq!(parties[1].role, "被告");
        assert_eq!(parties[1].name, "北京某某科技有限公司");
        assert_eq!(parties[0].source_file, "起诉状.docx");
    }

    #[test]
    fn dedupes_party_names_across_docs() {
        let parties = parse_parties(&[
            doc("起诉状.docx", "原告：张三，男。\n被告：李四。"),
            doc("判决书.txt", "原告：张三。\n被告：李四。\n第三人：王五。"),
        ]);
        assert_eq!(
            parties.iter().map(|p| p.name.as_str()).collect::<Vec<_>>(),
            vec!["张三", "李四", "王五"]
        );
    }

    #[test]
    fn longer_roles_win_over_prefix_roles() {
        let parties = parse_parties(&[doc(
            "上诉状.docx",
            "上诉人（原审被告）：甲公司\n被上诉人（原审原告）：乙公司",
        )]);
        assert_eq!(parties[0].role, "上诉人");
        assert_eq!(parties[0].name, "甲公司");
        assert_eq!(parties[1].role, "被上诉人");
        assert_eq!(parties[1].name, "乙公司");
    }

    #[test]
    fn parses_indexed_roles_and_enforcement_roles() {
        let parties = parse_parties(&[doc(
            "执行申请书.txt",
            "申请执行人：张三\n被执行人1：李四\n被执行人2：王五",
        )]);
        assert_eq!(parties[0].role, "申请执行人");
        assert_eq!(
            parties.iter().map(|p| p.name.as_str()).collect::<Vec<_>>(),
            vec!["张三", "李四", "王五"]
        );
    }

    #[test]
    fn rejects_overlong_or_empty_names() {
        let long_name = "甲".repeat(31);
        let parties = parse_parties(&[doc("a.txt", &format!("原告：{long_name}\n被告："))]);
        assert!(parties.is_empty());
    }

    #[test]
    fn does_not_match_roles_mid_line() {
        let parties = parse_parties(&[doc("a.txt", "本案原告：张三的诉讼请求如下")]);
        assert!(parties.is_empty());
    }

    // ---- 案由 ----

    #[test]
    fn explicit_cause_wins_with_high_confidence() {
        let field = parse_cause(
            &[doc("判决书.txt", "案由：民间借贷纠纷")],
            "某文件夹",
            &[],
        )
        .unwrap();
        assert_eq!(field.value, "民间借贷纠纷");
        assert_eq!(field.confidence, Confidence::High);
    }

    #[test]
    fn cause_from_yian_phrase() {
        let field = parse_cause(
            &[doc("通知.txt", "因房屋买卖合同纠纷一案，本院已立案受理。")],
            "x",
            &[],
        )
        .unwrap();
        assert_eq!(field.value, "房屋买卖合同纠纷");
        assert_eq!(field.confidence, Confidence::Medium);
    }

    #[test]
    fn cause_anchored_by_party_name() {
        let parties = vec![PartyDraft {
            role: "被告".to_string(),
            name: "李四".to_string(),
            source_file: "起诉状.docx".to_string(),
        }];
        let field = parse_cause(
            &[doc("受理通知书.txt", "张三诉李四民间借贷纠纷一案，本院决定立案审理。")],
            "x",
            &parties,
        )
        .unwrap();
        assert_eq!(field.value, "民间借贷纠纷");
    }

    #[test]
    fn cause_from_folder_name_strips_party_prefix() {
        let parties = vec![PartyDraft {
            role: "被告".to_string(),
            name: "李四".to_string(),
            source_file: "起诉状.docx".to_string(),
        }];
        let field = parse_cause(&[], "张三诉李四民间借贷纠纷", &parties).unwrap();
        assert_eq!(field.value, "民间借贷纠纷");
        assert_eq!(field.source_file, "文件夹名");
        assert_eq!(field.confidence, Confidence::Low);
    }

    #[test]
    fn folder_cause_without_known_parties_is_rejected_when_long() {
        // 没有当事人可剥、剩余串过长 → 宁可不给，避免把人名混进案由
        assert!(parse_cause(&[], "张三诉李四王五民间借贷纠纷", &[]).is_none());
    }

    #[test]
    fn folder_cause_pure_segment_accepted() {
        let field = parse_cause(&[], "2024-001 合同纠纷 张某", &[]).unwrap();
        assert_eq!(field.value, "合同纠纷");
    }

    // ---- 法院 ----

    #[test]
    fn line_anchored_court_wins_with_high_confidence() {
        let field = parse_court(&[doc("判决书.txt", JUDGMENT_HEAD)]).unwrap();
        assert_eq!(field.value, "北京市朝阳区人民法院");
        assert_eq!(field.confidence, Confidence::High);
    }

    #[test]
    fn inline_court_strips_leading_noise() {
        let field = parse_court(&[doc(
            "通知.txt",
            "本案经北京市海淀区人民法院审理后作出判决。",
        )])
        .unwrap();
        assert_eq!(field.value, "北京市海淀区人民法院");
        assert_eq!(field.confidence, Confidence::Medium);
    }

    #[test]
    fn picks_most_frequent_court() {
        let docs = vec![
            doc("a.txt", "上海市浦东新区人民法院\n上海市浦东新区人民法院"),
            doc("b.txt", "上海市第一中级人民法院"),
        ];
        let field = parse_court(&docs).unwrap();
        assert_eq!(field.value, "上海市浦东新区人民法院");
    }

    #[test]
    fn recognizes_specialized_courts() {
        let field = parse_court(&[doc("a.txt", "北京互联网法院\n")]).unwrap();
        assert_eq!(field.value, "北京互联网法院");
    }

    // ---- 阶段推断 ----

    #[test]
    fn stage_matrix() {
        // 执行文书 → enforcement（且优先于判决）
        let (stage, evidence) = infer_stage(
            &["执行通知书.pdf".to_string(), "判决书.docx".to_string()],
            &[],
            true,
        );
        assert_eq!(stage, "enforcement");
        assert!(evidence[0].contains("执行通知"));

        // 判决书 → judgment
        let (stage, _) = infer_stage(&["民事判决书.docx".to_string()], &[], true);
        assert_eq!(stage, "judgment");

        // 受理通知 → filed
        let (stage, _) = infer_stage(&["受理通知书.pdf".to_string()], &[], false);
        assert_eq!(stage, "filed");

        // 无文书关键词但解析到案号 → filed
        let (stage, evidence) = infer_stage(&["合同.txt".to_string()], &[], true);
        assert_eq!(stage, "filed");
        assert_eq!(evidence, vec!["已解析到案号".to_string()]);

        // 起诉状但无案号 → filing_prep
        let (stage, _) = infer_stage(&["民事起诉状.docx".to_string()], &[], false);
        assert_eq!(stage, "filing_prep");

        // 什么都没有 → intake
        let (stage, evidence) = infer_stage(&["会议记录.txt".to_string()], &[], false);
        assert_eq!(stage, "intake");
        assert!(evidence.is_empty());
    }

    #[test]
    fn enforcement_ruling_is_not_judgment() {
        let (stage, _) = infer_stage(&["执行裁定书.pdf".to_string()], &[], true);
        assert_eq!(stage, "enforcement");
    }

    #[test]
    fn stage_from_doc_content() {
        let (stage, evidence) =
            infer_stage(&["文书.txt".to_string()], &[doc("文书.txt", JUDGMENT_HEAD)], true);
        assert_eq!(stage, "judgment");
        assert!(evidence.iter().any(|e| e.contains("判决书")));
    }

    // ---- 案件名建议 ----

    #[test]
    fn title_prefers_informative_folder_name() {
        assert_eq!(build_title("张三诉李四案", &[], None), "张三诉李四案");
    }

    #[test]
    fn title_composed_from_parties_when_folder_uninformative() {
        let parties = vec![
            PartyDraft {
                role: "原告".to_string(),
                name: "张三".to_string(),
                source_file: "a".to_string(),
            },
            PartyDraft {
                role: "被告".to_string(),
                name: "李四".to_string(),
                source_file: "a".to_string(),
            },
        ];
        let cause = FieldDraft {
            value: "民间借贷纠纷".to_string(),
            source_file: "a".to_string(),
            confidence: Confidence::High,
        };
        assert_eq!(
            build_title("2024-001", &parties, Some(&cause)),
            "张三与李四民间借贷纠纷"
        );
    }

    #[test]
    fn title_falls_back_to_folder_name() {
        assert_eq!(build_title("2024-001", &[], None), "2024-001");
    }

    // ---- 整体（含 docx fixture 与零写入） ----

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("case_parse_test_{tag}_{nanos}"));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn list_all(dir: &Path) -> Vec<PathBuf> {
        let mut out = Vec::new();
        let mut stack = vec![dir.to_path_buf()];
        while let Some(current) = stack.pop() {
            for entry in std::fs::read_dir(&current).unwrap().flatten() {
                out.push(entry.path());
                if entry.file_type().unwrap().is_dir() {
                    stack.push(entry.path());
                }
            }
        }
        out.sort();
        out
    }

    #[test]
    fn parse_folder_end_to_end_without_writing() {
        let base = temp_dir("e2e");
        let case_dir = base.join("张三诉李四民间借贷纠纷");
        std::fs::create_dir_all(case_dir.join("文书")).unwrap();
        // docx 起诉状
        let complaint_xml = format!(
            "<w:document><w:body>{}</w:body></w:document>",
            COMPLAINT_HEAD
                .lines()
                .map(|l| format!("<w:p><w:r><w:t>{l}</w:t></w:r></w:p>"))
                .collect::<String>()
        );
        std::fs::write(
            case_dir.join("文书").join("民事起诉状.docx"),
            make_docx(&complaint_xml),
        )
        .unwrap();
        // txt 受理通知
        std::fs::write(
            case_dir.join("受理通知书.txt"),
            "北京市朝阳区人民法院\n受理通知书\n（2023）京0105民初12345号\n案由：民间借贷纠纷",
        )
        .unwrap();
        // 跳过的 PDF
        std::fs::write(case_dir.join("证据.pdf"), b"%PDF-1.4").unwrap();

        let before = list_all(&case_dir);
        let draft = parse_folder(&case_dir).unwrap();
        let after = list_all(&case_dir);
        // 零写入：目录内容完全不变
        assert_eq!(before, after);

        assert_eq!(draft.title_suggestion, "张三诉李四民间借贷纠纷");
        assert_eq!(draft.case_no.as_ref().unwrap().value, "（2023）京0105民初12345号");
        assert_eq!(draft.cause_of_action.as_ref().unwrap().value, "民间借贷纠纷");
        assert_eq!(draft.court_name.as_ref().unwrap().value, "北京市朝阳区人民法院");
        assert_eq!(draft.stage_suggestion, "filed");
        assert_eq!(draft.parties.len(), 2);
        assert_eq!(draft.parties[0].name, "张三");
        assert_eq!(draft.skipped_pdf_count, 1);
        assert!(draft.notes.iter().any(|n| n.contains("PDF")));
        assert_eq!(draft.scanned_files.len(), 2);

        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn parse_folder_missing_dir_is_error() {
        let base = temp_dir("missing");
        assert!(parse_folder(&base.join("不存在")).is_err());
        std::fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn collect_scan_decodes_gbk_txt() {
        let base = temp_dir("gbk");
        let (encoded, _, _) = encoding_rs::GB18030.encode("原告：张三，男。");
        std::fs::write(base.join("备注.txt"), encoded.as_ref()).unwrap();
        let scan = collect_folder_scan(&base).unwrap();
        assert_eq!(scan.docs.len(), 1);
        assert!(scan.docs[0].text.contains("张三"));
        std::fs::remove_dir_all(&base).ok();
    }
