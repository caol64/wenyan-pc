import { invoke } from "@tauri-apps/api/core";

export interface UploadResponse {
    media_id: string;
    url: string;
}

export async function uploadImageBridge(
    sourceType: "local" | "network" | "base64" | "blob",
    data: string | Uint8Array,
    filename?: string,
    autoCache: boolean = true,
): Promise<UploadResponse> {
    // If it's Uint8Array (blob), we convert to base64 to pass through JSON invoke
    // Or if Tauri supports Uint8Array directly in invoke (which it does)
    return await invoke("upload_image", { sourceType, data, filename, autoCache });
}
