import { getFileExtension } from "$lib/utils";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { basename } from "@tauri-apps/api/path";
import { readFile } from "@tauri-apps/plugin-fs";

export async function downloadImageToBase64(src: string): Promise<string> {
    // 获取图片二进制数据
    const response = await tauriFetch(src);
    const arrayBuffer = await response.arrayBuffer();

    // 将 ArrayBuffer 转换为 Base64 字符串
    return await bufferToBase64(arrayBuffer);
}

function bufferToBase64(buffer: ArrayBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([buffer]);
        const reader = new FileReader();

        reader.onload = () => {
            const result = reader.result;
            // 结果通常是 "data:application/octet-stream;base64,xxxx"
            if (typeof result === "string") {
                // const base64 = result.split(',')[1];
                resolve(result);
            } else {
                reject(new Error("Failed to convert buffer to base64 string"));
            }
        };

        reader.onerror = () => {
            reject(new Error("FileReader error occurred"));
        };

        reader.readAsDataURL(blob);
    });
}

// 将路径转换为 Blob/File 对象
export async function pathToFile(path: string): Promise<File> {
    const uint8Array = await readFile(path);
    const fileName = (await basename(path)) || "image.png";
    const mimeType = getMimeType(fileName);
    const blob = new Blob([uint8Array], { type: mimeType });
    return new File([blob], fileName, { type: mimeType });
}

function getMimeType(fileName: string): string {
    const ext = getFileExtension(fileName);
    const map: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        md: "text/markdown",
        txt: "text/plain",
    };
    return map[ext || ""] || "application/octet-stream";
}

export async function localPathToBase64(path: string): Promise<string> {
    const uint8Array = await readFile(path);
    return await bufferToBase64(uint8Array.buffer);
}

export async function urlToFile(url: string, defaultName?: string): Promise<File> {
    const response = await tauriFetch(url);
    const arrayBuffer = await response.arrayBuffer();

    // 例如从 https://example.com/path/to/pic.jpg?v=1 中提取 pic.jpg
    const urlPath = new URL(url).pathname;
    const fileName = defaultName || urlPath.split("/").pop() || "downloaded_image";

    // 优先尝试从响应头获取，如果没有则根据文件名推断
    const mimeType = response.headers.get("content-type") || getMimeType(fileName);

    return new File([arrayBuffer], fileName, { type: mimeType });
}

export async function base64ToFile(base64: string, fileName: string = "image.png"): Promise<File> {
    // 1. 如果包含 data:前缀，拆分出 mime 和 纯 base64 内容
    let mimeType = "image/png";
    let b64Data = base64;

    if (base64.startsWith("data:")) {
        const parts = base64.split(",");
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) mimeType = mimeMatch[1];
        b64Data = parts[1];
    } else {
        // 如果没有前缀，则尝试根据文件名推断 mime
        mimeType = getMimeType(fileName);
    }

    // 2. 将 base64 转换为 Uint8Array
    const binaryString = atob(b64Data);
    const len = binaryString.length;
    const uint8Array = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
    }

    // 3. 构建并返回 File 对象
    return new File([uint8Array], fileName, { type: mimeType });
}
