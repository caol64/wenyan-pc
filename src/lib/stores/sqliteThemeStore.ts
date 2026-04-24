import type { ThemeStorageAdapter, CustomTheme } from "@wenyan-md/ui";
import * as themeBridge from "../bridge/theme";

export const sqliteThemeStorageAdapter: ThemeStorageAdapter = {
    async load() {
        const themes = await themeBridge.loadThemes();
        const customThemes: Record<string, CustomTheme> = Object.fromEntries(
            themes.map((theme) => [theme.id, theme]),
        );
        return customThemes;
    },

    async save(id: string, name: string, css: string): Promise<string> {
        // 如果 id 为 '0' 或 null/undefined，则传 null 给后端表示新建
        const actualId = id === "0" || !id ? null : id;
        return await themeBridge.saveTheme(actualId, name, css);
    },

    async remove(id: string) {
        await themeBridge.removeTheme(id);
    },
};
