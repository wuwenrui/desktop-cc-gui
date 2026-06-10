//! .docx 纯文本抽取：zip 内取 `word/document.xml`，剥 XML 标签得文本。
//!
//! 段落（`</w:p>`）/ 换行（`<w:br/>`）/ 表格行（`</w:tr>`）转换行，
//! `<w:tab/>` 转制表符，命名与数字实体解码。规则解析只需要行结构，
//! 不还原任何排版。

use regex::Regex;
use std::io::{Cursor, Read};

/// 从 .docx 文件字节中抽取纯文本。
pub(crate) fn extract_docx_text(bytes: &[u8]) -> Result<String, String> {
    let mut archive =
        zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("打开 docx 失败: {e}"))?;
    let mut entry = archive
        .by_name("word/document.xml")
        .map_err(|_| "docx 缺少 word/document.xml".to_string())?;
    let mut xml = String::new();
    entry
        .read_to_string(&mut xml)
        .map_err(|e| format!("读取 document.xml 失败: {e}"))?;
    Ok(document_xml_to_text(&xml))
}

/// 把 `word/document.xml` 转成按段落分行的纯文本。
pub(crate) fn document_xml_to_text(xml: &str) -> String {
    // 段落结束 / 显式换行 / 回车 / 表格行结束 → 换行
    let breaks = Regex::new(r"</w:p>|<w:br(?:\s[^>]*)?/?>|<w:cr(?:\s[^>]*)?/>|</w:tr>")
        .expect("valid breaks regex");
    // 制表符（注意不要误伤 <w:tabs> 容器标签）
    let tabs = Regex::new(r"<w:tab(?:\s[^>]*)?/>").expect("valid tab regex");
    let tags = Regex::new(r"<[^>]+>").expect("valid tag regex");

    let text = breaks.replace_all(xml, "\n");
    let text = tabs.replace_all(&text, "\t");
    let text = tags.replace_all(&text, "");
    let text = decode_entities(&text);

    // 行首尾去空白（XML 标签间缩进无语义），丢弃空行——规则解析只需要内容行。
    let lines: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    lines.join("\n")
}

/// 解码 XML 命名实体与数字实体（`&#NNN;` / `&#xHHH;`）。
fn decode_entities(text: &str) -> String {
    let numeric = Regex::new(r"&#(x[0-9a-fA-F]{1,6}|\d{1,7});").expect("valid entity regex");
    let decoded = numeric.replace_all(text, |caps: &regex::Captures| {
        let body = &caps[1];
        let code = match body.strip_prefix('x') {
            Some(hex) => u32::from_str_radix(hex, 16).ok(),
            None => body.parse::<u32>().ok(),
        };
        code.and_then(char::from_u32)
            .map(|c| c.to_string())
            .unwrap_or_default()
    });
    decoded
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&amp;", "&")
}

#[cfg(test)]
pub(crate) fn make_docx(document_xml: &str) -> Vec<u8> {
    use std::io::Write;
    let mut buf = Vec::new();
    {
        let mut writer = zip::ZipWriter::new(Cursor::new(&mut buf));
        let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default();
        writer.start_file("word/document.xml", opts).unwrap();
        writer.write_all(document_xml.as_bytes()).unwrap();
        writer.finish().unwrap();
    }
    buf
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_paragraphs_as_lines() {
        let xml = r#"<?xml version="1.0"?><w:document><w:body>
            <w:p><w:r><w:t>民事起诉状</w:t></w:r></w:p>
            <w:p><w:r><w:t>原告：张三</w:t></w:r></w:p>
            <w:p><w:r><w:t>被告：</w:t></w:r><w:r><w:t>李四</w:t></w:r></w:p>
        </w:body></w:document>"#;
        let docx = make_docx(xml);
        let text = extract_docx_text(&docx).unwrap();
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines, vec!["民事起诉状", "原告：张三", "被告：李四"]);
    }

    #[test]
    fn converts_breaks_and_tabs() {
        let xml = "<w:p><w:r><w:t>第一行</w:t><w:br/><w:t>第二行</w:t><w:tab/><w:t>缩进</w:t></w:r></w:p>";
        let text = document_xml_to_text(xml);
        assert_eq!(text, "第一行\n第二行\t缩进");
    }

    #[test]
    fn strips_tabs_container_without_losing_body_text() {
        // <w:tabs> 是制表位容器；其内部定义不应留下可见文本
        let xml = "<w:pPr><w:tabs><w:tab w:val=\"left\" w:pos=\"100\"/></w:tabs></w:pPr><w:p><w:r><w:t>正文</w:t></w:r></w:p>";
        let text = document_xml_to_text(xml);
        assert_eq!(text.trim(), "正文");
    }

    #[test]
    fn decodes_named_and_numeric_entities() {
        let xml = "<w:p><w:r><w:t>甲 &amp; 乙 &lt;合同&gt; &#x4E2D;&#22269;</w:t></w:r></w:p>";
        let text = document_xml_to_text(xml);
        assert_eq!(text, "甲 & 乙 <合同> 中国");
    }

    #[test]
    fn missing_document_xml_is_an_error() {
        let mut buf = Vec::new();
        {
            use std::io::Write;
            let mut writer = zip::ZipWriter::new(Cursor::new(&mut buf));
            let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default();
            writer.start_file("other.xml", opts).unwrap();
            writer.write_all(b"x").unwrap();
            writer.finish().unwrap();
        }
        let err = extract_docx_text(&buf).unwrap_err();
        assert!(err.contains("word/document.xml"));
    }

    #[test]
    fn not_a_zip_is_an_error() {
        assert!(extract_docx_text(b"plain text").is_err());
    }

    #[test]
    fn drops_empty_paragraphs() {
        let xml = "<w:p><w:r><w:t>甲</w:t></w:r></w:p><w:p></w:p><w:p></w:p><w:p><w:r><w:t>乙</w:t></w:r></w:p>";
        let text = document_xml_to_text(xml);
        assert_eq!(text, "甲\n乙");
    }
}
