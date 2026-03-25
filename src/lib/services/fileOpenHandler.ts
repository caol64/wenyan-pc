import { listen } from "@tauri-apps/api/event";
import { globalState } from "@wenyan-md/ui";
import { handleMarkdownFile } from "./markdownContentHandler";

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
