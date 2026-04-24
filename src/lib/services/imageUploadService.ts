import { settingsStore } from "@wenyan-md/ui";
import { uploadImageBridge, type UploadResponse } from "../bridge/upload";
import { getLastArticleRelativePath } from "$lib/stores/sqliteArticleStore";
import { resolvePath } from "../bridge/system";

// 匹配 Markdown 图片语法的正则: ![alt](url)
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

export async function uploadBlobImageWithCache(file: File): Promise<UploadResponse> {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    return await uploadImageBridge("blob", uint8Array, file.name, settingsStore.uploadSettings.autoCache);
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
        const resolvedSrc = await resolvePath(oldSrc, relativeTo);

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
    return replaceImagesInMarkdown(
        markdown,
        (src) => !src.startsWith("http") && !src.startsWith("data:"),
        (src) => uploadImageBridge("local", src, undefined, settingsStore.uploadSettings.autoCache),
        relativeTo
    );
}

export function replaceNetworkImagesInMarkdown(markdown: string) {
    if (!settingsStore.uploadSettings.autoUploadNetwork) {
        return { text: markdown, replaced: false };
    }
    return replaceImagesInMarkdown(
        markdown,
        (src) => src.startsWith("http"),
        (src) => uploadImageBridge("network", src, undefined, settingsStore.uploadSettings.autoCache)
    );
}

export async function uploadImage(imageUrl: string): Promise<UploadResponse> {
    let sourceType: "local" | "network" | "base64" | "blob" = "local";
    let data = imageUrl;

    if (imageUrl.startsWith("http")) {
        sourceType = "network";
    } else if (imageUrl.startsWith("data:")) {
        sourceType = "base64";
    } else {
        const lastArticleRelativePath = await getLastArticleRelativePath();
        data = await resolvePath(imageUrl, lastArticleRelativePath || undefined);
    }

    return await uploadImageBridge(sourceType, data, undefined, settingsStore.uploadSettings.autoCache);
}
