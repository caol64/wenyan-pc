import { sqliteUploadCacheStore } from "$lib/stores/sqliteUploadCacheStore";
import { calculateHashFromPath, calculateHash } from "$lib/utils";
import { settingsStore } from "@wenyan-md/ui";
import { pathToFile } from "./imageProxy";
import { uploadFileCore } from "./wechatHandler";

export async function uploadImageWithCache(input: File | string): Promise<string> {
    let file: File;
    let md5: string | null = null;

    if (typeof input === "string") {
        md5 = settingsStore.uploadSettings.autoCache ? await calculateHashFromPath(input) : null;
        file = await pathToFile(input);
    } else {
        md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(input) : null;
        file = input;
    }

    if (md5) {
        const cached = await sqliteUploadCacheStore.get(md5);
        if (cached) return cached.mediaId;
    }

    const url = await uploadFileCore(file, file.name);

    if (md5) {
        await sqliteUploadCacheStore.set(md5, url);
    }

    return url;
}
