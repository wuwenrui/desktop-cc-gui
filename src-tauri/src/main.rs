// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if should_sync_path_env_at_startup() {
        cc_gui_lib::path_env::sync_path_env_at_startup();
    }
    cc_gui_lib::run()
}

fn should_sync_path_env_at_startup() -> bool {
    false
}

#[cfg(test)]
mod tests {
    #[test]
    fn gui_startup_skips_login_shell_path_sync() {
        assert!(!super::should_sync_path_env_at_startup());
    }
}
