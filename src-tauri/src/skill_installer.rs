//! Install public skills bundled into the app's resource directory into the
//! user's global Claude skills directory (`~/.claude/skills/`).
//!
//! The bundled `skills/` resource directory may contain `.md` files at the top
//! level as well as nested skill folders.
//! Only `.md` files are copied; the directory structure is preserved.

use sha2::{Digest, Sha256};
use std::path::Path;

const SENSITIVE_BUNDLED_SKILL_PATHS: &[&str] = &[
    "制度审查.md",
    "劳动用工小助理/SKILL.md",
    "合同起草与审查.md",
    "律师函（催款类）.md",
    "撰写不良资产尽调报告.md",
    "法律意见.md",
    "破产业务小助手.md",
];

struct SensitiveBundledSkill {
    relative_path: &'static str,
    sha256: &'static str,
}

const LEGACY_SENSITIVE_BUNDLED_SKILLS: &[SensitiveBundledSkill] = &[
    SensitiveBundledSkill {
        relative_path: "制度审查.md",
        sha256: "3675bd022ad56730c8edfe49699414af2093b68f738a69c2ec35eb58f037723c",
    },
    SensitiveBundledSkill {
        relative_path: "劳动用工小助理/SKILL.md",
        sha256: "e521f88991959c46985769e522119bd58641492c7066056e57e6ee5697d12fd4",
    },
    SensitiveBundledSkill {
        relative_path: "合同起草与审查.md",
        sha256: "099f269a8d526c6b5083913c390194b065c9d1108bd5b6605bf43788b764a0be",
    },
    SensitiveBundledSkill {
        relative_path: "律师函（催款类）.md",
        sha256: "dce2344eb248c8e7f703a407a46298360183853596cd3cf85bca849d2486f92a",
    },
    SensitiveBundledSkill {
        relative_path: "撰写不良资产尽调报告.md",
        sha256: "bb35253d084622826bb4a123759a5e0645fd76fd00269e6addda4e1f3ee4229f",
    },
    SensitiveBundledSkill {
        relative_path: "法律意见.md",
        sha256: "8ebf084e63280d59c22fa6f2278c1695874a7c9eb2b8362229af49549cf27bbb",
    },
    SensitiveBundledSkill {
        relative_path: "破产业务小助手.md",
        sha256: "1cb6507ceceac2957f784a481c2c4e790c21de0493c6cf289427fee1fc0dea8f",
    },
];

fn normalized_relative_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn is_sensitive_bundled_skill_path(relative_path: &Path) -> bool {
    let normalized = normalized_relative_path(relative_path);
    SENSITIVE_BUNDLED_SKILL_PATHS
        .iter()
        .any(|path| *path == normalized)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn remove_empty_parent_dirs(skills_root: &Path, relative_file_path: &Path) {
    let mut current = skills_root
        .join(relative_file_path)
        .parent()
        .map(Path::to_path_buf);
    while let Some(dir) = current {
        if dir == skills_root {
            break;
        }
        let is_empty = std::fs::read_dir(&dir)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);
        if !is_empty {
            break;
        }
        if std::fs::remove_dir(&dir).is_err() {
            break;
        }
        current = dir.parent().map(Path::to_path_buf);
    }
}

fn remove_sensitive_bundled_skills_with_manifest(
    skills_root: &Path,
    manifest: &[SensitiveBundledSkill],
) -> Result<usize, String> {
    let mut removed = 0;
    for skill in manifest {
        let relative_path = Path::new(skill.relative_path);
        let target = skills_root.join(relative_path);
        if !target.is_file() {
            continue;
        }
        let content = std::fs::read(&target).map_err(|e| e.to_string())?;
        if sha256_hex(&content) != skill.sha256 {
            continue;
        }
        std::fs::remove_file(&target).map_err(|e| e.to_string())?;
        remove_empty_parent_dirs(skills_root, relative_path);
        removed += 1;
    }
    Ok(removed)
}

pub fn remove_legacy_sensitive_bundled_skills(skills_root: &Path) -> Result<usize, String> {
    remove_sensitive_bundled_skills_with_manifest(skills_root, LEGACY_SENSITIVE_BUNDLED_SKILLS)
}

pub fn cleanup_legacy_sensitive_bundled_skills() -> Result<usize, String> {
    let home = dirs::home_dir().ok_or("no home")?;
    remove_legacy_sensitive_bundled_skills(&home.join(".claude").join("skills"))
}

/// Recursively copy every `.md` file from `src` into `dst`, preserving the
/// directory layout. Returns the number of `.md` files copied.
pub fn install_skills(src: &Path, dst: &Path) -> Result<usize, String> {
    install_skills_inner(src, dst, Path::new(""), true)
}

/// Like [`install_skills`] but never overwrites existing files — only fills
/// gaps. Safe to run on every startup: bundled skills added after the user's
/// onboarding land automatically, while user edits stay untouched.
pub fn install_missing_skills(src: &Path, dst: &Path) -> Result<usize, String> {
    install_skills_inner(src, dst, Path::new(""), false)
}

fn install_skills_inner(
    src: &Path,
    dst: &Path,
    relative_dir: &Path,
    overwrite: bool,
) -> Result<usize, String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    let mut n = 0;
    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let p = entry.map_err(|e| e.to_string())?.path();
        let name = match p.file_name() {
            Some(name) => name,
            None => continue,
        };
        let relative_path = relative_dir.join(name);
        if p.is_dir() {
            n += install_skills_inner(&p, &dst.join(name), &relative_path, overwrite)?;
        } else if p.extension().and_then(|s| s.to_str()) == Some("md") {
            if is_sensitive_bundled_skill_path(&relative_path) {
                continue;
            }
            let target = dst.join(name);
            if !overwrite && target.exists() {
                continue;
            }
            std::fs::copy(&p, target).map_err(|e| e.to_string())?;
            n += 1;
        }
    }
    Ok(n)
}

/// Startup hook: clean legacy sensitive skills, then fill in bundled skills
/// missing from `~/.claude/skills/`（onboarding 之后新增的 bundled skill
/// 对老用户也要可用——侧栏点击靠已安装列表解析，缺文件就会"点了没反应"）。
pub fn sync_bundled_skills_on_startup(app: &tauri::AppHandle) -> Result<usize, String> {
    use tauri::Manager;
    let resource = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("skills");
    let home = dirs::home_dir().ok_or("no home")?;
    let skills_root = home.join(".claude").join("skills");
    let _ = remove_legacy_sensitive_bundled_skills(&skills_root);
    install_missing_skills(&resource, &skills_root)
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
    let skills_root = home.join(".claude").join("skills");
    let _ = remove_legacy_sensitive_bundled_skills(&skills_root);
    install_skills(&resource, &skills_root)
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
        fs::write(src.join("通用写作.md"), "top-level skill").unwrap();
        fs::write(src.join("文档整理.md"), "another skill").unwrap();
        // A non-.md file that must be ignored
        fs::write(src.join("ignore.txt"), "not a skill").unwrap();
        // Nested skill folder
        let nested = src.join("项目助手");
        fs::create_dir_all(&nested).unwrap();
        fs::write(nested.join("SKILL.md"), "nested skill body").unwrap();
        // Non-.md file inside nested folder must be ignored
        fs::write(nested.join("data.json"), "{}").unwrap();

        let copied = install_skills(&src, &dst).unwrap();
        assert_eq!(
            copied, 3,
            "should copy 3 .md files (2 top-level + 1 nested)"
        );

        // Top-level files present with content preserved
        assert!(dst.join("通用写作.md").exists());
        assert_eq!(
            fs::read_to_string(dst.join("文档整理.md")).unwrap(),
            "another skill"
        );
        // Nested directory + file preserved
        let nested_dst = dst.join("项目助手").join("SKILL.md");
        assert!(nested_dst.exists(), "nested SKILL.md should be copied");
        assert_eq!(fs::read_to_string(nested_dst).unwrap(), "nested skill body");
        // Non-.md files must not be copied
        assert!(!dst.join("ignore.txt").exists());
        assert!(!dst.join("项目助手").join("data.json").exists());

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

    #[test]
    fn skips_sensitive_bundled_skills_during_install() {
        let base = temp_dir("sensitive_skip");
        let src = base.join("src");
        let dst = base.join("dst");
        fs::create_dir_all(src.join("劳动用工小助理")).unwrap();
        fs::write(src.join("制作PPT.md"), "allowed skill").unwrap();
        fs::write(src.join("制度审查.md"), "sensitive skill").unwrap();
        fs::write(
            src.join("劳动用工小助理").join("SKILL.md"),
            "sensitive nested skill",
        )
        .unwrap();

        let copied = install_skills(&src, &dst).unwrap();

        assert_eq!(copied, 1);
        assert!(dst.join("制作PPT.md").exists());
        assert!(!dst.join("制度审查.md").exists());
        assert!(!dst.join("劳动用工小助理").join("SKILL.md").exists());

        fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn install_missing_fills_gaps_without_overwriting_user_edits() {
        let base = temp_dir("fill_gaps");
        let src = base.join("src");
        let dst = base.join("dst");
        fs::create_dir_all(&src).unwrap();
        fs::create_dir_all(&dst).unwrap();
        fs::write(src.join("既有技能.md"), "bundled v2").unwrap();
        fs::write(src.join("新技能.md"), "brand new").unwrap();
        fs::write(dst.join("既有技能.md"), "user edited").unwrap();

        let copied = install_missing_skills(&src, &dst).unwrap();

        assert_eq!(copied, 1, "only the missing skill should be copied");
        assert_eq!(
            fs::read_to_string(dst.join("既有技能.md")).unwrap(),
            "user edited",
            "existing files must never be overwritten"
        );
        assert_eq!(fs::read_to_string(dst.join("新技能.md")).unwrap(), "brand new");

        fs::remove_dir_all(&base).ok();
    }

    #[test]
    fn removes_only_legacy_sensitive_copies_with_matching_hash() {
        let base = temp_dir("sensitive_cleanup");
        let dst = base.join("dst");
        fs::create_dir_all(dst.join("劳动用工小助理")).unwrap();
        fs::write(dst.join("制度审查.md"), "legacy sensitive skill").unwrap();
        fs::write(dst.join("法律意见.md"), "user edited skill").unwrap();
        fs::write(dst.join("制作PPT.md"), "allowed skill").unwrap();
        fs::write(
            dst.join("劳动用工小助理").join("SKILL.md"),
            "legacy nested skill",
        )
        .unwrap();

        let manifest = [
            SensitiveBundledSkill {
                relative_path: "制度审查.md",
                sha256: "1e11627ef0646b0c40509ac97c6d02737785d9aaf66dfe09f8575ac54657cb02",
            },
            SensitiveBundledSkill {
                relative_path: "劳动用工小助理/SKILL.md",
                sha256: "c9bd28c68e1e968cee8643f084753ce3f96a5b2270f3601a294ec6eb0f272eb5",
            },
            SensitiveBundledSkill {
                relative_path: "法律意见.md",
                sha256: "1e11627ef0646b0c40509ac97c6d02737785d9aaf66dfe09f8575ac54657cb02",
            },
        ];

        let removed = remove_sensitive_bundled_skills_with_manifest(&dst, &manifest).unwrap();

        assert_eq!(removed, 2);
        assert!(!dst.join("制度审查.md").exists());
        assert!(!dst.join("劳动用工小助理").exists());
        assert!(dst.join("法律意见.md").exists());
        assert!(dst.join("制作PPT.md").exists());

        fs::remove_dir_all(&base).ok();
    }
}
