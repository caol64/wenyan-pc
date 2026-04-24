import { globalState } from "@wenyan-md/ui";
import { handleMarkdownFile } from "./markdownContentHandler";
import { onOpenFile } from "../bridge/events";

export function initFileOpenListener(onOpen: (file: string) => void) {
    onOpenFile(onOpen);
}

export async function handleFileOpen(file: string) {
    try {
        globalState.isLoading = true;
        const finalText = await handleMarkdownFile(file);
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
