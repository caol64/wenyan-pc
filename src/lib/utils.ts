import { writeHtml, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { resolveResource } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";

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

export async function loadMarkdownFromPath(path: string): Promise<string> {
    return await readTextFile(path);
}
