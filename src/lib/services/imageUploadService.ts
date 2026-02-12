import { sqliteUploadCacheStore } from "$lib/stores/sqliteUploadCacheStore";
import { calculateHashFromPath, calculateHash, getAbsoluteImagePath } from "$lib/utils";
import { settingsStore } from "@wenyan-md/ui";
import { base64ToFile, pathToFile, urlToFile } from "./imageProxy";
import { uploadFileCore } from "./wechatHandler";
import type { WechatUploadResponse } from "@wenyan-md/core/wechat";
import { isAbsolute } from "@tauri-apps/api/path";
import { getLastArticle, type ArticleDO } from "$lib/stores/sqliteArticleStore";

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

export async function uploadLocalImageWithCache(path: string): Promise<WechatUploadResponse> {
    const lastArticle = await getLastArticle();
    const resolvedSrc = await resolveArticleRelativePath(path, lastArticle);
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHashFromPath(resolvedSrc) : null;
    const file = await pathToFile(resolvedSrc);
    return await uploadImageWithCache(md5, file);
}

export async function uploadNetworkImageWithCache(url: string): Promise<WechatUploadResponse> {
    const file = await urlToFile(url);
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}

export async function uploadMemImageWithCache(file: File): Promise<WechatUploadResponse> {
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}

export async function uploadBase64ImageWithCache(base64: string): Promise<WechatUploadResponse> {
    const file = await base64ToFile(base64);
    const md5 = settingsStore.uploadSettings.autoCache ? await calculateHash(file) : null;
    return await uploadImageWithCache(md5, file);
}

async function replaceImagesInMarkdown(
    markdown: string,
    predicate: (src: string) => boolean,
    uploader: (src: string) => Promise<{ url: string }>,
    relativeTo?: string
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

export async function resolveArticleRelativePath(path: string, article: ArticleDO | null): Promise<string> {
    if (!article) {
        return path;
    }
    const relativeTo = article.relativePath || undefined;
    return await resolveRelativePath(path, relativeTo);
}

async function resolveRelativePath(path: string, relative?: string): Promise<string> {
    if (path.startsWith("http")) {
        return path;
    }
    const isAbsolutePath = await isAbsolute(path);
    if (isAbsolutePath) {
        return path;
    }
    if (relative) {
        return getAbsoluteImagePath(relative, path);
    }
    return path;
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
