import { settingsStore } from "@wenyan-md/ui";
import { uploadImageBridge, type UploadResponse } from "../bridge/upload";

export async function uploadBlobImageWithCache(file: File): Promise<UploadResponse> {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    return await uploadImageBridge(
        "blob",
        uint8Array,
        file.name,
        settingsStore.uploadSettings.autoCache,
        settingsStore.enabledImageHost === "wechat",
    );
}

export async function uploadImage(imageUrl: string): Promise<UploadResponse> {
    return await uploadImageBridge(
        "auto",
        imageUrl,
        undefined,
        settingsStore.uploadSettings.autoCache,
        settingsStore.enabledImageHost === "wechat",
    );
}
