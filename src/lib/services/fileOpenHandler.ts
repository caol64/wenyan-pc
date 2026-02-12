import { listen } from "@tauri-apps/api/event";
import { globalState } from "@wenyan-md/ui";
import { replaceLocalImagesInMarkdown, replaceNetworkImagesInMarkdown } from "./imageUploadService";
import { updateLastArticlePath } from "$lib/stores/sqliteArticleStore";
import { unpackFilePath } from "$lib/utils";
import { readTextFile } from "@tauri-apps/plugin-fs";

export function initFileOpenListener(onOpen: (file: string) => void) {
    listen<string>("open-file", (event) => {
        const filePath = event.payload;
        // console.log("Open file from system:", filePath);
        onOpen(filePath);
    });
}

export async function handleFileOpen(file: string) {
    try {
        globalState.isLoading = true;
        const content = await readTextFile(file);
        globalState.setMarkdownText(content);
        const { fileName, dir } = await unpackFilePath(file);
        await updateLastArticlePath(fileName, file, dir);
        const { text } = await replaceLocalImagesInMarkdown(content, dir);
        const { text: finalText } = await replaceNetworkImagesInMarkdown(text);
        globalState.setMarkdownText(finalText);
    } catch (error) {
        globalState.setAlertMessage({
            type: "error",
            message: `处理文件出错: ${error instanceof Error ? error.message : error}`,
        });
    } finally {
        globalState.isLoading = false;
    }
}
