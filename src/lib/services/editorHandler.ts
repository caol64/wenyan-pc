import type { EditorView } from "@codemirror/view";
import { globalState } from "@wenyan-md/ui";
import { getFileExtension, readFileAsText } from "$lib/utils";
import { replaceLocalImagesInMarkdown, replaceNetworkImagesInMarkdown, uploadMemImageWithCache } from "./imageUploadService";

const imgType = ["image/bmp", "image/png", "image/jpeg", "image/gif", "video/mp4"];


export async function defaultEditorPasteHandler(event: ClipboardEvent, view: EditorView) {
    const clipboardData = event.clipboardData;
    const files = clipboardData?.files;
    if (files && files.length > 0 && canHandleFile(files[0])) {
        // 粘贴图片
        event.preventDefault();
        await handleImageUpload(files[0], view);
        return;
    }
    const original = clipboardData?.getData("text/plain");
    if (!original) {
        return;
    }
    try {
        event.preventDefault();
        globalState.isLoading = true;
        const selectionSnapshot = view.state.selection.main;
        const insertFrom = selectionSnapshot.from;
        const insertTo = selectionSnapshot.to;
        const { text } = await replaceLocalImagesInMarkdown(original);
        const { text: finalText } = await replaceNetworkImagesInMarkdown(text);

        view.dispatch({
            changes: {
                from: insertFrom,
                to: insertTo,
                insert: finalText,
            },
            selection: { anchor: insertFrom + finalText.length },
        });
        view.focus();
    } catch (error) {
        console.error("File paste error:", error);
        globalState.setAlertMessage({
            type: "error",
            message: `处理文件出错: ${error instanceof Error ? error.message : error}`,
        });
    } finally {
        globalState.isLoading = false;
    }
}

export async function defaultEditorDropHandler(event: DragEvent, view: EditorView) {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const extension = getFileExtension(file.name).toLowerCase();
    const isMarkdown = extension === "md" || file.type === "text/markdown";

    if (canHandleFile(file)) {
        // 拖拽图片
        event.preventDefault();
        await handleImageUpload(file, view);
        return;
    }
    if (isMarkdown) {
        // 拖拽文档
        event.preventDefault();
        try {
            const content = await readFileAsText(file);
            globalState.setMarkdownText(content);
            globalState.isLoading = true;
            const { text } = await replaceLocalImagesInMarkdown(content);
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
}

function canHandleFile(file: File): boolean {
    return file && imgType.includes(file.type);
}

async function handleImageUpload(file: File, view: EditorView) {
    globalState.isLoading = true;

    try {
        const resp = await uploadMemImageWithCache(file);
        const markdown = `\n![${file.name}](${resp.url})\n`;

        const { from, to } = view.state.selection.main;

        view.dispatch({
            changes: { from, to, insert: markdown },
            selection: { anchor: from + markdown.length },
        });

        view.focus();
    } catch (e) {
        globalState.setAlertMessage({
            type: "error",
            message: String(e),
        });
    } finally {
        globalState.isLoading = false;
    }
}


