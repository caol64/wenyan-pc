import * as uploadCacheBridge from "../bridge/upload_cache";

class SqliteUploadCacheStore {
    async get(md5: string): Promise<any> {
        return await uploadCacheBridge.getUploadCache(md5);
    }

    async set(md5: string, mediaId: string, url: string) {
        await uploadCacheBridge.setUploadCache(md5, mediaId, url);
    }

    async clear() {
        await uploadCacheBridge.clearUploadCache();
    }
}

export const sqliteUploadCacheStore = new SqliteUploadCacheStore();
