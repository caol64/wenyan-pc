import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export async function downloadImage(src: string): Promise<string> {

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
export function bufferToBase64(buffer: ArrayBuffer): Promise<string> {
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
