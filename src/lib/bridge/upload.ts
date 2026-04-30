import { invoke } from "@tauri-apps/api/core";

export interface UploadResponse {
    media_id: string;
    url: string;
}

export interface ProcessMarkdownOptions {
    relativeTo?: string;
    autoUploadLocal: boolean;
    autoUploadNetwork: boolean;
    autoCache: boolean;
}

export async function uploadImageBridge(
    sourceType: "local" | "network" | "base64" | "blob" | "auto",
    data: string | Uint8Array,
    filename?: string,
    autoCache: boolean = true,
    wechatEnabled?: boolean,
): Promise<UploadResponse> {
    return await invoke("upload_image", { sourceType, data, filename, autoCache, wechatEnabled });
}

export async function processMarkdownContentBridge(
    content: string,
    options: ProcessMarkdownOptions,
): Promise<string> {
    return await invoke("process_markdown_content", { content, options });
}
