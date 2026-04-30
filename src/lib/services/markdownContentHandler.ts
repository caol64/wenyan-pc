import { settingsStore } from "@wenyan-md/ui";
import { openProcessedMarkdownFile } from "../bridge/article";
import { processMarkdownContentBridge } from "../bridge/upload";

export async function handleMarkdownContent(content: string, relativeTo?: string): Promise<string> {
    return await processMarkdownContentBridge(content, {
        relativeTo,
        autoUploadLocal: settingsStore.uploadSettings.autoUploadLocal,
        autoUploadNetwork: settingsStore.uploadSettings.autoUploadNetwork,
        autoCache: settingsStore.uploadSettings.autoCache,
    });
}

export async function handleMarkdownFile(path: string): Promise<string> {
    return await openProcessedMarkdownFile(path, {
        autoUploadLocal: settingsStore.uploadSettings.autoUploadLocal,
        autoUploadNetwork: settingsStore.uploadSettings.autoUploadNetwork,
        autoCache: settingsStore.uploadSettings.autoCache,
    });
}
