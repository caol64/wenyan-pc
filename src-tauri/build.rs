use std::{collections::HashMap, env, fs, path::{Path, PathBuf}};

const UPDATER_ENV_KEYS: [&str; 3] = [
    "WENYAN_UPDATER_ENDPOINT",
    "WENYAN_UPDATER_ENDPOINTS",
    "WENYAN_UPDATER_PUBKEY",
];

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing CARGO_MANIFEST_DIR"));
    let repo_root_env = manifest_dir
        .parent()
        .map(|path| path.join(".env"))
        .unwrap_or_else(|| manifest_dir.join(".env"));
    let crate_env = manifest_dir.join(".env");

    println!("cargo:rerun-if-changed={}", repo_root_env.display());
    println!("cargo:rerun-if-changed={}", crate_env.display());

    for key in UPDATER_ENV_KEYS {
        println!("cargo:rerun-if-env-changed={key}");
    }

    let mut dotenv_values = HashMap::new();
    merge_dotenv(&repo_root_env, &mut dotenv_values);
    merge_dotenv(&crate_env, &mut dotenv_values);

    for key in UPDATER_ENV_KEYS {
        if let Ok(value) = env::var(key) {
            println!("cargo:rustc-env={key}={value}");
        } else if let Some(value) = dotenv_values.get(key) {
            println!("cargo:rustc-env={key}={value}");
        }
    }

    tauri_build::build()
}

fn merge_dotenv(path: &Path, values: &mut HashMap<String, String>) {
    let Ok(content) = fs::read_to_string(path) else {
        return;
    };

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let Some((raw_key, raw_value)) = trimmed.split_once('=') else {
            continue;
        };

        let key = raw_key.trim().trim_start_matches("export ").trim();
        if !UPDATER_ENV_KEYS.contains(&key) {
            continue;
        }

        let value = strip_matching_quotes(raw_value.trim());
        values.insert(key.to_string(), value.to_string());
    }
}

fn strip_matching_quotes(value: &str) -> &str {
    if value.len() >= 2 {
        let bytes = value.as_bytes();
        let first = bytes[0];
        let last = bytes[value.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return &value[1..value.len() - 1];
        }
    }

    value
}
