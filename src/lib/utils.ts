import { writeHtml, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { resolveResource, isAbsolute, resolve, dirname, basename } from "@tauri-apps/api/path";
import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { articleStore, bufferToBase64 } from "@wenyan-md/ui";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export async function writeHtmlToClipboard(html: string): Promise<void> {
    await writeHtml(html);
}

export async function writeTextToClipboard(text: string): Promise<void> {
    await writeText(text);
}

export async function readExampleArticle(): Promise<string> {
    const resourcePath = await resolveResource("resources/example.md");
    return await readTextFile(resourcePath);
}

export async function getDefaultArticle(): Promise<string> {
    const article = articleStore.getLastArticle();
    return article ? article : await readExampleArticle();
}

export async function getPathType(src: string) {
    // 1. 判断是否为网络路径 (http/https/data-uri)
    if (/^(https?|data|blob):/i.test(src)) {
        return "network";
    }

    // 2. 判断是否为绝对路径 (跨平台通用)
    // 在 Windows 上它能识别 C:\ 或 \\server
    // 在 Mac/Linux 上它能识别 /Users/...
    const absolute = await isAbsolute(src);
    if (absolute) {
        return "absolute-local";
    }

    // 3. 剩下的通常被视为相对路径
    // 例如：./img/avatar.png 或 ../assets/logo.png
    return "relative-local";
}

export async function calculateHash(blobOrFile: Blob): Promise<string> {
    // 1. 将 Blob/File 转为 ArrayBuffer
    const buffer = await blobOrFile.arrayBuffer();

    // 2. 转为 Uint8Array
    const uint8Array = new Uint8Array(buffer);

    // 3. 调用 Rust 命令
    const md5 = await invoke<string>("get_data_md5", {
        data: uint8Array,
    });
    return md5;
}

export async function calculateHashFromPath(path: string): Promise<string> {
    const md5 = await invoke<string>("get_file_md5", { path });
    return md5;
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
    const isAbsolutePath = await isAbsolute(path);
    if (isAbsolutePath) {
        return await resolve(path);
    }
    if (relative) {
        return getAbsoluteImagePath(relative, path);
    }
    return path;
}

export async function getAbsoluteImagePath(basePath: string, relativePath: string) {
    const absolutePath = await resolve(basePath, relativePath);
    return absolutePath;
}

export async function unpackFilePath(path: string): Promise<{ fileName: string; dir: string }> {
    const fileName = await basename(path);
    const dir = await dirname(path);
    return { fileName, dir };
}

export class FIFOCache<K, V> {
    private cache: Map<K, V>;
    private readonly max: number;

    constructor(max: number = 50) {
        this.cache = new Map<K, V>();
        this.max = max;
    }

    get(key: K): V | undefined {
        return this.cache.get(key);
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.set(key, value);
            return;
        }

        if (this.cache.size >= this.max) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(key, value);
    }

    clear(): void {
        this.cache.clear();
    }
}

export async function downloadImageToBase64(src: string): Promise<string> {
    // 获取图片二进制数据
    const response = await tauriFetch(src);
    const arrayBuffer = await response.arrayBuffer();

    // 将 ArrayBuffer 转换为 Base64 字符串
    return await bufferToBase64(arrayBuffer);
}

export async function localPathToBase64(path: string): Promise<string> {
    const uint8Array = await readFile(path);
    return await bufferToBase64(uint8Array.buffer);
}
