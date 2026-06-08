use std::path::{Component, Path};

pub(super) fn is_builtin_ignored_path(path: &Path) -> bool {
    path.components().any(|component| {
        let Component::Normal(segment) = component else {
            return false;
        };
        let Some(segment) = segment.to_str() else {
            return false;
        };
        matches!(
            segment,
            ".git"
                | ".hg"
                | ".svn"
                | "node_modules"
                | "target"
                | "dist"
                | "build"
                | "out"
                | ".next"
                | ".turbo"
                | ".vite"
                | ".cache"
                | ".ccgui"
                | ".mossx"
                | ".codemoss"
        )
    })
}

pub(super) fn is_manifest_path(path: &str) -> bool {
    let normalized = path.to_ascii_lowercase();
    let basename = normalized.rsplit('/').next().unwrap_or(&normalized);
    matches!(
        basename,
        "package.json"
            | "cargo.toml"
            | "pom.xml"
            | "build.gradle"
            | "build.gradle.kts"
            | "settings.gradle"
            | "settings.gradle.kts"
            | "go.mod"
            | "pyproject.toml"
            | "requirements.txt"
            | "composer.json"
            | "gemfile"
            | "package.swift"
            | "pubspec.yaml"
            | "pubspec.yml"
            | "dockerfile"
            | "docker-compose.yml"
            | "docker-compose.yaml"
            | "makefile"
            | "cmakelists.txt"
    ) || basename.starts_with("dockerfile")
        || basename.starts_with("makefile")
        || (basename.starts_with("requirements") && basename.ends_with(".txt"))
        || basename.ends_with(".csproj")
        || basename.ends_with(".sln")
        || basename.ends_with(".tf")
}

pub(super) fn language_for_project_file(path: &str, extension: &str) -> &'static str {
    let normalized = path.to_ascii_lowercase();
    let basename = normalized.rsplit('/').next().unwrap_or(&normalized);
    if basename.starts_with("dockerfile") {
        return "dockerfile";
    }
    if basename.starts_with("makefile") {
        return "makefile";
    }
    if basename == "cmakelists.txt" {
        return "cmake";
    }
    match extension {
        "ts" | "tsx" => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "rs" => "rust",
        "java" => "java",
        "kt" | "kts" => "kotlin",
        "py" => "python",
        "go" => "go",
        "cs" => "csharp",
        "php" => "php",
        "rb" => "ruby",
        "c" => "c",
        "cc" | "cpp" | "cxx" | "h" | "hpp" | "hh" => "cpp",
        "swift" => "swift",
        "dart" => "dart",
        "vue" => "vue",
        "svelte" => "svelte",
        "json" => "json",
        "toml" => "toml",
        "xml" => "xml",
        "yaml" | "yml" => "yaml",
        "properties" => "properties",
        "gradle" => "gradle",
        "tf" | "hcl" => "terraform",
        "sql" => "sql",
        "html" | "htm" => "html",
        "md" | "mdx" => "markdown",
        "css" | "scss" | "sass" | "less" => "css",
        "sh" | "bash" | "zsh" => "shell",
        "txt" => "text",
        _ => "unknown",
    }
}

pub(super) fn should_read_project_text_file(path: &str, extension: &str) -> bool {
    !matches!(language_for_project_file(path, extension), "unknown")
}

pub(super) fn classify_layer(path: &str, extension: &str) -> &'static str {
    let normalized = path.to_ascii_lowercase();
    if normalized.contains("/tests/")
        || normalized.contains("/test/")
        || normalized.ends_with(".test.ts")
        || normalized.ends_with(".test.tsx")
        || normalized.ends_with(".spec.ts")
        || normalized.ends_with(".spec.tsx")
        || normalized.ends_with("test.java")
        || normalized.ends_with("tests.java")
        || normalized.ends_with("_test.rs")
    {
        "test"
    } else if matches!(extension, "css" | "scss" | "sass" | "less") {
        "style"
    } else if normalized.starts_with("openspec/") || normalized.contains("/openspec/") {
        "spec"
    } else if normalized.starts_with("docs/") || matches!(extension, "md" | "mdx") {
        "docs"
    } else if normalized.starts_with("src-tauri/")
        || normalized.starts_with("src/main/java/")
        || normalized.contains("/server/")
        || normalized.contains("/api/")
        || matches!(
            extension,
            "rs" | "java" | "kt" | "kts" | "py" | "go" | "cs" | "php" | "rb"
        )
    {
        "backend"
    } else if normalized.starts_with("src/")
        || matches!(
            extension,
            "ts" | "tsx" | "js" | "jsx" | "vue" | "svelte" | "html" | "htm"
        )
    {
        "frontend"
    } else if is_manifest_path(&normalized)
        || matches!(
            extension,
            "json"
                | "toml"
                | "xml"
                | "yaml"
                | "yml"
                | "properties"
                | "gradle"
                | "tf"
                | "hcl"
                | "sql"
        )
    {
        "config"
    } else {
        "unknown"
    }
}

pub(super) fn classify_role(path: &str, extension: &str) -> &'static str {
    let normalized = path.to_ascii_lowercase();
    if is_manifest_path(&normalized) {
        "manifest"
    } else if normalized.contains("/migrations/") || matches!(extension, "sql") {
        "migration"
    } else if matches!(extension, "tf" | "hcl")
        || normalized
            .rsplit('/')
            .next()
            .unwrap_or(&normalized)
            .starts_with("dockerfile")
    {
        "infra"
    } else if normalized.ends_with(".test.ts")
        || normalized.ends_with(".test.tsx")
        || normalized.ends_with(".spec.ts")
        || normalized.ends_with(".spec.tsx")
        || normalized.ends_with("test.java")
        || normalized.ends_with("tests.java")
        || normalized.ends_with("_test.rs")
    {
        "test"
    } else if normalized.contains("/components/") || normalized.ends_with(".tsx") {
        "component"
    } else if normalized.contains("/hooks/") || normalized.contains("/use") {
        "hook"
    } else if normalized.contains("/services/") || normalized.contains("/service/") {
        "service"
    } else if normalized.contains("/controller/") || normalized.contains("/controllers/") {
        "controller"
    } else if normalized.contains("/repository/") || normalized.contains("/repositories/") {
        "repository"
    } else if normalized.contains("/entity/")
        || normalized.contains("/entities/")
        || normalized.contains("/model/")
    {
        "entity"
    } else if normalized.ends_with("types.ts") || normalized.ends_with("/types.rs") {
        "type"
    } else if matches!(extension, "css" | "scss" | "sass" | "less") {
        "style"
    } else if normalized.contains("commands.rs") || normalized.contains("command_registry.rs") {
        "command"
    } else if normalized.starts_with("openspec/") {
        "spec"
    } else if normalized.contains("/routes/") || normalized.contains("/router/") {
        "route"
    } else if matches!(
        extension,
        "json" | "toml" | "xml" | "yaml" | "yml" | "properties" | "gradle" | "tf" | "hcl"
    ) {
        "config"
    } else if matches!(extension, "md" | "mdx") {
        "document"
    } else if matches!(extension, "rs") {
        "module"
    } else {
        "unknown"
    }
}

pub(super) fn module_label(path: &str) -> String {
    let segments = path.split('/').collect::<Vec<_>>();
    if segments.len() >= 3 && segments[0] == "src" && segments[1] == "features" {
        return format!("frontend:{}", segments[2]);
    }
    if segments.len() >= 3 && segments[0] == "src-tauri" && segments[1] == "src" {
        return format!("backend:{}", segments[2].trim_end_matches(".rs"));
    }
    segments.first().copied().unwrap_or("root").to_string()
}
