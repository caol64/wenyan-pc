import Database from "@tauri-apps/plugin-sql";

export class DBInstance {
    private static instance: Database | null = null;
    private static initPromise: Promise<Database> | null = null;

    static async getInstance(): Promise<Database> {
        if (DBInstance.instance) return DBInstance.instance;

        if (DBInstance.initPromise) return DBInstance.initPromise;

        DBInstance.initPromise = (async () => {
            const db = await Database.load("sqlite:data.db");
            await db.execute(`CREATE TABLE IF NOT EXISTS CustomTheme (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt TEXT NOT NULL
            );`);
            await db.execute(`CREATE TABLE IF NOT EXISTS Article (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                createdAt TEXT NOT NULL
            );`);
            await db.execute(`CREATE TABLE IF NOT EXISTS Credential (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                name TEXT,
                appId TEXT,
                appSecret TEXT,
                accessToken TEXT,
                refreshToken TEXT,
                expireTime INTEGER,
                updatedAt INTEGER,
                createdAt TEXT NOT NULL
            );`);
            DBInstance.instance = db;
            return db;
        })();

        return DBInstance.initPromise;
    }
}
