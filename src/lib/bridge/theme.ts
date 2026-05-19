import type { CustomTheme } from "@wenyan-md/ui";
import { invokeBridge } from "./invoke";

export async function loadThemes(): Promise<CustomTheme[]> {
    return await invokeBridge("load_themes");
}

export async function saveTheme(id: string | null, name: string, css: string): Promise<string> {
    return await invokeBridge("save_theme", { id, name, css });
}

export async function removeTheme(id: string): Promise<void> {
    await invokeBridge("remove_theme", { id });
}
