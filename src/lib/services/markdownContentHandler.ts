import { replaceLocalImagesInMarkdown, replaceNetworkImagesInMarkdown } from "./imageUploadService";
import { unpackFilePath } from "../bridge/system";
import { openMarkdownFile } from "../bridge/article";
import { getLastArticleRelativePath } from "$lib/stores/sqliteArticleStore";

export async function handleMarkdownContent(content: string, relativeTo?: string): Promise<string> {
    const dir = relativeTo || (await getLastArticleRelativePath()) || undefined;
    const { text } = await replaceLocalImagesInMarkdown(content, dir);
    const { text: finalText } = await replaceNetworkImagesInMarkdown(text);
    return finalText;
}

export async function handleMarkdownFile(path: string): Promise<string> {
    const content = await openMarkdownFile(path);
    const { dir } = await unpackFilePath(path);
    return await handleMarkdownContent(content, dir);
}
