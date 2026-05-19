import { invokeBridge } from "./invoke";

export async function getUploadCache(md5: string): Promise<any> {
    return await invokeBridge("get_upload_cache", { md5 });
}

export async function setUploadCache(md5: string, mediaId: string, url: string): Promise<void> {
    await invokeBridge("set_upload_cache", { md5, mediaId, url });
}

export async function clearUploadCache(): Promise<void> {
    await invokeBridge("clear_upload_cache");
}
