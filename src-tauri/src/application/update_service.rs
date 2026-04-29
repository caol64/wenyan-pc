use crate::dto::update::UpdateInfoDto;
use crate::error::{AppError, AppResult};
use reqwest::Url;
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::UpdaterExt;

const UPDATER_ENDPOINT: Option<&str> = option_env!("WENYAN_UPDATER_ENDPOINT");
const UPDATER_ENDPOINTS: Option<&str> = option_env!("WENYAN_UPDATER_ENDPOINTS");
const UPDATER_PUBKEY: Option<&str> = option_env!("WENYAN_UPDATER_PUBKEY");

pub struct UpdateService<'a, R: Runtime> {
    app_handle: &'a AppHandle<R>,
}

impl<'a, R: Runtime> UpdateService<'a, R> {
    pub fn new(app_handle: &'a AppHandle<R>) -> Self {
        Self { app_handle }
    }

    pub fn is_configured() -> bool {
        configured_pubkey().is_some() && !configured_endpoint_strings().is_empty()
    }

    pub async fn check_for_update(&self) -> AppResult<Option<UpdateInfoDto>> {
        ensure_windows_runtime()?;
        let update = self
            .build_updater()?
            .check()
            .await
            .map_err(|error| AppError::Network(error.to_string()))?;

        Ok(update.map(|update| UpdateInfoDto {
            current_version: update.current_version.to_string(),
            version: update.version.to_string(),
            date: update.date.map(|date| date.to_string()),
            body: update.body.clone(),
        }))
    }

    pub async fn install_update(&self) -> AppResult<()> {
        ensure_windows_runtime()?;
        let updater = self.build_updater()?;
        let update = updater
            .check()
            .await
            .map_err(|error| AppError::Network(error.to_string()))?;

        let Some(update) = update else {
            return Err(AppError::InvalidRequest("当前已是最新版本。".into()));
        };

        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|error| AppError::Network(error.to_string()))?;

        Ok(())
    }

    fn build_updater(&self) -> AppResult<tauri_plugin_updater::Updater> {
        let pubkey = configured_pubkey()
            .ok_or_else(|| AppError::InvalidRequest("当前构建未配置自动更新公钥。".into()))?;
        let endpoints = configured_endpoints()?;

        self.app_handle
            .updater_builder()
            .pubkey(pubkey)
            .endpoints(endpoints)
            .map_err(|error| AppError::InvalidRequest(error.to_string()))?
            .build()
            .map_err(|error| AppError::InvalidRequest(error.to_string()))
    }
}

fn configured_pubkey() -> Option<&'static str> {
    UPDATER_PUBKEY
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| Box::leak(value.replace("\\n", "\n").into_boxed_str()) as &'static str)
}

fn configured_endpoint_strings() -> Vec<&'static str> {
    UPDATER_ENDPOINTS
        .or(UPDATER_ENDPOINT)
        .map(|value| {
            value
                .split([',', '\n'])
                .map(str::trim)
                .filter(|endpoint| !endpoint.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn configured_endpoints() -> AppResult<Vec<Url>> {
    let endpoints = configured_endpoint_strings();
    if endpoints.is_empty() {
        return Err(AppError::InvalidRequest("当前构建未配置自动更新地址。".into()));
    }

    endpoints
        .into_iter()
        .map(|endpoint| Url::parse(endpoint).map_err(|error| AppError::InvalidRequest(error.to_string())))
        .collect()
}

fn ensure_windows_runtime() -> AppResult<()> {
    if cfg!(target_os = "windows") {
        Ok(())
    } else {
        Err(AppError::InvalidRequest("自动更新当前仅支持 Windows 桌面端。".into()))
    }
}
