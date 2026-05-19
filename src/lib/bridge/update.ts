import { isTauri } from "@tauri-apps/api/core";
import { invokeBridge } from "./invoke";

export interface UpdateInfo {
    currentVersion: string;
    version: string;
    date?: string | null;
    body?: string | null;
}

export function isTauriRuntime(): boolean {
    return isTauri();
}

export async function isUpdaterEnabled(): Promise<boolean> {
    if (!isTauri()) {
        return false;
    }

    return await invokeBridge("is_updater_enabled");
}

export async function checkForAppUpdate(): Promise<UpdateInfo | null> {
    return await invokeBridge("check_for_app_update");
}

export async function installAppUpdate(): Promise<void> {
    await invokeBridge("install_app_update");
}
