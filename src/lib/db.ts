import Database from "@tauri-apps/plugin-sql";

export class DBInstance {
    private static instance: Database | null = null;
    static async getInstance(): Promise<Database> {
        if (!DBInstance.instance) {
            DBInstance.instance = await Database.load("sqlite:data.db");
            await DBInstance.instance.execute(`CREATE TABLE IF NOT EXISTS CustomTheme (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt TEXT NOT NULL
            );`);
            await DBInstance.instance.execute(`CREATE TABLE IF NOT EXISTS Article (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt TEXT NOT NULL
            );`);
        }
        return DBInstance.instance;
    }
}
