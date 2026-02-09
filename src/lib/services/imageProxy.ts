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

/**
 * 将 ArrayBuffer 转换为 Base64 字符串
 * @param buffer 输入的二进制数据
 * @returns Promise 包含 Base64 编码的字符串
 */
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
