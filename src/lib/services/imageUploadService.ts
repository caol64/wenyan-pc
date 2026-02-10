import { sqliteUploadCacheStore } from "$lib/stores/sqliteUploadCacheStore";
import { calculateHashFromPath, calculateHash } from "$lib/utils";
import { settingsStore } from "@wenyan-md/ui";
import { base64ToFile, pathToFile, urlToFile } from "./imageProxy";
import { uploadFileCore } from "./wechatHandler";
import type { WechatUploadResponse } from "@wenyan-md/core/wechat";

async function uploadImageWithCache(md5: string | null, file: File): Promise<WechatUploadResponse> {
    if (md5) {
        const cached = await sqliteUploadCacheStore.get(md5);
        if (cached) return { media_id: cached.mediaId, url: cached.url };
    }

    const data = await uploadFileCore(file, file.name);

    if (md5) {
        await sqliteUploadCacheStore.set(md5, data.media_id, data.url);
    }

    return data;
}

export async function uploadLocalImageWithCache(path: string): Promise<WechatUploadResponse> {
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHashFromPath(path) : null;
    const file = await pathToFile(path);
    return await uploadImageWithCache(md5, file);
}

export async function uploadNetworkImageWithCache(url: string): Promise<WechatUploadResponse> {
    const file = await urlToFile(url);
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}

export async function uploadMemImageWithCache(file: File): Promise<WechatUploadResponse> {
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}

export async function uploadBase64ImageWithCache(base64: string): Promise<WechatUploadResponse> {
    const file = await base64ToFile(base64);
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}
