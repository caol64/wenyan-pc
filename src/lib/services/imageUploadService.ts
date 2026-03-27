import { sqliteUploadCacheStore } from "$lib/stores/sqliteUploadCacheStore";
import { calculateHashFromPath, calculateHash, resolveRelativePath } from "$lib/utils";
import { getFileExtension, settingsStore } from "@wenyan-md/ui";
import { uploadFileCore } from "./wechatHandler";
import type { WechatUploadResponse } from "@wenyan-md/core/wechat";
import { getLastArticleRelativePath } from "$lib/stores/sqliteArticleStore";
import { readFile } from "@tauri-apps/plugin-fs";
import { basename } from "@tauri-apps/api/path";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

// 匹配 Markdown 图片语法的正则: ![alt](url)
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

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

async function uploadLocalImageWithCache(path: string): Promise<WechatUploadResponse> {
    const lastArticleRelativePath = await getLastArticleRelativePath();
    const resolvedSrc = await resolveRelativePath(path, lastArticleRelativePath || undefined);
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHashFromPath(resolvedSrc) : null;
    const file = await pathToFile(resolvedSrc);
    return await uploadImageWithCache(md5, file);
}

async function uploadNetworkImageWithCache(url: string): Promise<WechatUploadResponse> {
    const file = await urlToFile(url);
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}

export async function uploadBlobImageWithCache(file: File): Promise<WechatUploadResponse> {
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}

async function uploadBase64ImageWithCache(base64: string): Promise<WechatUploadResponse> {
    const file = await base64ToFile(base64);
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}

async function replaceImagesInMarkdown(
    markdown: string,
    predicate: (src: string) => boolean,
    uploader: (src: string) => Promise<{ url: string }>,
    relativeTo?: string,
): Promise<{ text: string; replaced: boolean }> {
    const matches = Array.from(markdown.matchAll(IMAGE_REGEX));

    const targetImages = matches.filter((m) => {
        const src = m[2];
        return src && predicate(src);
    });

    if (targetImages.length === 0) {
        return { text: markdown, replaced: false };
    }

    const replaceMap = new Map<string, string>();

    for (const match of targetImages) {
        const oldSrc = match[2];
        const resolvedSrc = await resolveRelativePath(oldSrc, relativeTo);

        if (replaceMap.has(oldSrc)) continue;

        try {
            const resp = await uploader(resolvedSrc);
            replaceMap.set(oldSrc, resp.url);
        } catch (e) {
            console.error("Image upload failed:", oldSrc, e);
            // 允许部分成功
        }
    }

    let newText = markdown;

    replaceMap.forEach((newUrl, oldSrc) => {
        newText = newText.replaceAll(`](${oldSrc})`, `](${newUrl})`);
    });

    return {
        text: newText,
        replaced: replaceMap.size > 0,
    };
}

export function replaceLocalImagesInMarkdown(markdown: string, relativeTo?: string) {
    if (!settingsStore.uploadSettings.autoUploadLocal) {
        return { text: markdown, replaced: false };
    }
    return replaceImagesInMarkdown(markdown, (src) => !src.startsWith("http"), uploadLocalImageWithCache, relativeTo);
}

export function replaceNetworkImagesInMarkdown(markdown: string) {
    if (!settingsStore.uploadSettings.autoUploadNetwork) {
        return { text: markdown, replaced: false };
    }
    return replaceImagesInMarkdown(markdown, (src) => src.startsWith("http"), uploadNetworkImageWithCache);
}

export async function uploadImage(imageUrl: string): Promise<WechatUploadResponse> {
    if (imageUrl.startsWith("http")) {
        return await uploadNetworkImageWithCache(imageUrl);
    } else if (imageUrl.startsWith("data:")) {
        return await uploadBase64ImageWithCache(imageUrl);
    } else {
        return await uploadLocalImageWithCache(imageUrl);
    }
}

// 将路径转换为 Blob/File 对象
async function pathToFile(path: string): Promise<File> {
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

async function urlToFile(url: string, defaultName?: string): Promise<File> {
    const response = await tauriFetch(url);
    const arrayBuffer = await response.arrayBuffer();

    // 例如从 https://example.com/path/to/pic.jpg?v=1 中提取 pic.jpg
    const urlPath = new URL(url).pathname;
    const fileName = defaultName || urlPath.split("/").pop() || "downloaded_image";

    // 优先尝试从响应头获取，如果没有则根据文件名推断
    const mimeType = response.headers.get("content-type") || getMimeType(fileName);

    const ext = getFileExtension(fileName) || getExtensionFromMime(mimeType);
    const finalFileName = fileName.includes(".") ? fileName : `${fileName}.${ext}`;

    return new File([arrayBuffer], finalFileName, { type: mimeType });
}

async function base64ToFile(base64: string, fileName: string = "image.png"): Promise<File> {
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

const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "text/markdown": "md",
    "text/plain": "txt",
};

function getExtensionFromMime(mime: string): string {
    return map[mime] || "png";
}
