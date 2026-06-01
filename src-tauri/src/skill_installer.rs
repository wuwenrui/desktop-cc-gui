//! Install skills bundled into the app's resource directory into the user's
//! global Claude skills directory (`~/.claude/skills/`).
//!
//! The bundled `skills/` resource directory may contain `.md` files at the top
//! level as well as nested skill folders (e.g. `劳动用工小助理/SKILL.md`).
//! Only `.md` files are copied; the directory structure is preserved.

use std::path::Path;

/// Recursively copy every `.md` file from `src` into `dst`, preserving the
/// directory layout. Returns the number of `.md` files copied.
pub fn install_skills(src: &Path, dst: &Path) -> Result<usize, String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    let mut n = 0;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let p = entry.map_err(|e| e.to_string())?.path();
        let name = match p.file_name() {
            Some(name) => name,
            None => continue,
        };
        if p.is_dir() {
            n += install_skills(&p, &dst.join(name))?;
        } else if p.extension().and_then(|s| s.to_str()) == Some("md") {
            std::fs::copy(&p, dst.join(name)).map_err(|e| e.to_string())?;
            n += 1;
        }
    }
    Ok(n)
}

/// Tauri command: copy all bundled skills (`<resource_dir>/skills`) into
/// `~/.claude/skills/`. Returns the number of `.md` files installed.
#[tauri::command]
pub fn install_bundled_skills(app: tauri::AppHandle) -> Result<usize, String> {
    use tauri::Manager;
    let resource = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("skills");
    let home = dirs::home_dir().ok_or("no home")?;
    install_skills(&resource, &home.join(".claude").join("skills"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    /// Create a unique temporary directory under the OS temp dir.
    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("skill_installer_test_{tag}_{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn copies_top_level_and_nested_md_files() {
        let base = temp_dir("nested");
        let src = base.join("src");
        let dst = base.join("dst");

        // Top-level .md files
        fs::create_dir_all(&src).unwrap();
        fs::write(src.join("法律意见.md"), "top-level skill").unwrap();
        fs::write(src.join("制度审查.md"), "another skill").unwrap();
        // A non-.md file that must be ignored
        fs::write(src.join("ignore.txt"), "not a skill").unwrap();
        // Nested skill folder
        let nested = src.join("劳动用工小助理");
        fs::create_dir_all(&nested).unwrap();
        fs::write(nested.join("SKILL.md"), "nested skill body").unwrap();
        // Non-.md file inside nested folder must be ignored
        fs::write(nested.join("data.json"), "{}").unwrap();

        let copied = install_skills(&src, &dst).unwrap();
        assert_eq!(copied, 3, "should copy 3 .md files (2 top-level + 1 nested)");

        // Top-level files present with content preserved
        assert!(dst.join("法律意见.md").exists());
        assert_eq!(
            fs::read_to_string(dst.join("制度审查.md")).unwrap(),
            "another skill"
        );
        // Nested directory + file preserved
        let nested_dst = dst.join("劳动用工小助理").join("SKILL.md");
        assert!(nested_dst.exists(), "nested SKILL.md should be copied");
        assert_eq!(
            fs::read_to_string(nested_dst).unwrap(),
            "nested skill body"
        );
        // Non-.md files must not be copied
        assert!(!dst.join("ignore.txt").exists());
        assert!(!dst.join("劳动用工小助理").join("data.json").exists());

        fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn creates_destination_when_missing_and_empty_source_yields_zero() {
        let base = temp_dir("empty");
        let src = base.join("src");
        let dst = base.join("does").join("not").join("exist");
        fs::create_dir_all(&src).unwrap();

        let copied = install_skills(&src, &dst).unwrap();
        assert_eq!(copied, 0);
        assert!(dst.exists(), "destination dir should be created");

        fs::remove_dir_all(&base).ok();
    }
}
