import { readTextFile } from "@tauri-apps/plugin-fs";
import { replaceLocalImagesInMarkdown, replaceNetworkImagesInMarkdown } from "./imageUploadService";
import { unpackFilePath } from "../utils";
import { getLastArticleRelativePath, updateLastArticlePath } from "$lib/stores/sqliteArticleStore";

export async function handleMarkdownContent(content: string, relativeTo?: string): Promise<string> {
    const dir = relativeTo || (await getLastArticleRelativePath()) || undefined;
    const { text } = await replaceLocalImagesInMarkdown(content, dir);
    const { text: finalText } = await replaceNetworkImagesInMarkdown(text);
    return finalText;
}

export async function handleMarkdownFile(path: string): Promise<string> {
    const content = await readTextFile(path);
    const { fileName, dir } = await unpackFilePath(path);
    await updateLastArticlePath(fileName, path, dir);
    return await handleMarkdownContent(content, dir);
}
