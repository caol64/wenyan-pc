import { writeToClipboard, isAbsolutePath, getDataMd5, getFileMd5, resolvePath, downloadImage } from "./bridge/system";
import { getDefaultArticle as getDefaultArticleFromBridge } from "./bridge/article";
import { bufferToBase64 } from "@wenyan-md/ui";

export async function writeHtmlToClipboard(html: string): Promise<void> {
    await writeToClipboard("", html);
}

export async function writeTextToClipboard(text: string): Promise<void> {
    await writeToClipboard(text);
}

export async function readExampleArticle(): Promise<string> {
    return await getDefaultArticleFromBridge();
}

export async function getDefaultArticle(): Promise<string> {
    return await getDefaultArticleFromBridge();
}

export async function getPathType(src: string) {
    // 1. 判断是否为网络路径 (http/https/data-uri)
    if (/^(https?|data|blob):/i.test(src)) {
        return "network";
    }

    // 2. 判断是否为绝对路径 (跨平台通用)
    const absolute = await isAbsolutePath(src);
    if (absolute) {
        return "absolute-local";
    }

    // 3. 剩下的通常被视为相对路径
    return "relative-local";
}

export async function calculateHash(blobOrFile: Blob): Promise<string> {
    const buffer = await blobOrFile.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    return await getDataMd5(uint8Array);
}

export async function calculateHashFromPath(path: string): Promise<string> {
    return await getFileMd5(path);
}

export function getWenyanElement(): HTMLElement {
    const wenyanElement = document.getElementById("wenyan");
    if (!wenyanElement) {
        throw new Error("Wenyan element not found");
    }
    const clonedWenyan = wenyanElement.cloneNode(true) as HTMLElement;
    clonedWenyan.querySelectorAll("img").forEach(async (element) => {
        const dataSrc = element.getAttribute("data-src");
        if (dataSrc) {
            element.src = dataSrc;
        }
    });
    return clonedWenyan;
}

export async function resolveRelativePath(path: string, relative?: string): Promise<string> {
    if (path.startsWith("http")) {
        return path;
    }
    const isAbsolutePathVal = await isAbsolutePath(path);
    if (isAbsolutePathVal) {
        return await resolvePath(path);
    }
    if (relative) {
        return await resolvePath(path, relative);
    }
    return path;
}

export async function getAbsoluteImagePath(basePath: string, relativePath: string) {
    return await resolvePath(relativePath, basePath);
}

export async function downloadImageToBase64(url: string): Promise<string> {
    const uint8 = await downloadImage(url);
    // Convert Uint8Array to ArrayBuffer properly
    const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
    const base64 = await bufferToBase64(arrayBuffer);
    return `data:image/png;base64,${base64}`;
}

// Simple FIFO cache implementation
export class FIFOCache<K, V> {
    private cache: Map<K, V>;
    private keys: K[];
    private maxSize: number;

    constructor(maxSize: number = 100) {
        this.cache = new Map();
        this.keys = [];
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        return this.cache.get(key);
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            const idx = this.keys.indexOf(key);
            if (idx > -1) {
                this.keys.splice(idx, 1);
            }
        } else if (this.keys.length >= this.maxSize) {
            const oldestKey = this.keys.shift();
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }
        this.keys.push(key);
        this.cache.set(key, value);
    }

    clear(): void {
        this.cache.clear();
        this.keys = [];
    }
}

export async function localPathToBase64(path: string): Promise<string> {
    // For local images, we need to read the file and convert to base64
    // This should be done via a bridge call in the future
    // For now, we'll try to fetch via browser fetch or use a bridge
    try {
        const uint8 = await downloadImage(path);
        // Convert Uint8Array to ArrayBuffer properly
        const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
        const base64 = await bufferToBase64(arrayBuffer);
        // Determine mime type from path
        const ext = path.split('.').pop()?.toLowerCase() || 'png';
        const mimeTypes: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        return `data:${mimeType};base64,${base64}`;
    } catch {
        return '';
    }
}
