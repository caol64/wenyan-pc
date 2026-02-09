import { DBInstance } from "./db";

interface UploadCacheDO {
    id: number;
    md5: string;
    mediaId: string;
    lastUsed: string;
    createdAt: string;
}

class SqliteUploadCacheStore {
    async get(md5: string): Promise<UploadCacheDO | null> {
        const db = await DBInstance.getInstance();
        const rows = await db.select<UploadCacheDO[]>("SELECT * FROM UploadCache WHERE md5 = $1;", [md5]);
        return rows.length > 0 ? rows[0] : null;
    }

    async set(md5: string, mediaId: string) {
        const db = await DBInstance.getInstance();
        const now = new Date().toISOString();
        const existing = await this.get(md5);
        if (existing) {
            await db.execute("UPDATE UploadCache SET mediaId = $1, lastUsed = $2 WHERE id = $3;", [mediaId, now, existing.id]);
        } else {
            await db.execute("INSERT INTO UploadCache (md5, mediaId, lastUsed, createdAt) VALUES ($1, $2, $3, $4);", [
                md5,
                mediaId,
                now,
                now,
            ]);
        }
    }

    async clear() {
        const db = await DBInstance.getInstance();
        await db.execute("DELETE FROM UploadCache;");
    }
}

export const sqliteUploadCacheStore = new SqliteUploadCacheStore();
