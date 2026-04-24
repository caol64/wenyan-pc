import { invoke } from "@tauri-apps/api/core";

export async function getUploadCache(md5: string): Promise<any> {
    return await invoke("get_upload_cache", { md5 });
}

export async function setUploadCache(md5: string, mediaId: string, url: string): Promise<void> {
    await invoke("set_upload_cache", { md5, mediaId, url });
}

export async function clearUploadCache(): Promise<void> {
    await invoke("clear_upload_cache");
}
