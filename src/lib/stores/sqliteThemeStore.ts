import type { ThemeStorageAdapter, CustomTheme } from "@wenyan-md/ui";
import { DBInstance } from "./db";

interface ThemeDO {
    id: number;
    name: string;
    content: string;
    createdAt: string;
}

export const sqliteThemeStorageAdapter: ThemeStorageAdapter = {
    async load() {
        const db = await DBInstance.getInstance();
        const rows = await db.select<ThemeDO[]>("SELECT * FROM CustomTheme;");
        const customThemes: Record<string, CustomTheme> = Object.fromEntries(
            rows.map((row) => [
                String(row.id),
                {
                    id: String(row.id),
                    name: row.name,
                    css: row.content,
                },
            ]),
        );
        return customThemes;
    },

    async save(id: string, name: string, css: string): Promise<string> {
        const db = await DBInstance.getInstance();
        const row = await db.select<ThemeDO[]>("SELECT * FROM CustomTheme WHERE id = $1;", [id]);
        if (row.length === 0) {
            const result = await db.execute("INSERT INTO CustomTheme (name, content, createdAt) VALUES ($1, $2, $3);", [
                name,
                css,
                new Date().toISOString(),
            ]);
            return String(result.lastInsertId);
        } else {
            await db.execute("UPDATE CustomTheme SET content = $1, createdAt = $2 WHERE id = $3;", [
                css,
                new Date().toISOString(),
                id,
            ]);
            return id;
        }
    },

    async remove(id: string) {
        const db = await DBInstance.getInstance();
        await db.execute("DELETE FROM CustomTheme WHERE id = $1;", [id]);
    },
};
