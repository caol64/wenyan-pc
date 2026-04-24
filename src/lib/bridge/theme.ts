import { invoke } from "@tauri-apps/api/core";
import type { CustomTheme } from "@wenyan-md/ui";

export async function loadThemes(): Promise<CustomTheme[]> {
    return await invoke("load_themes");
}

export async function saveTheme(id: string | null, name: string, css: string): Promise<string> {
    return await invoke("save_theme", { id, name, css });
}

export async function removeTheme(id: string): Promise<void> {
    await invoke("remove_theme", { id });
}
