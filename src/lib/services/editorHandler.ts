import type { EditorView } from "@codemirror/view";
import { globalState, settingsStore } from "@wenyan-md/ui";
import { getFileExtension, readFileAsText } from "$lib/utils";
import { uploadImageWithCache } from "./imageUploadService";

const imgType = ["image/bmp", "image/png", "image/jpeg", "image/gif", "video/mp4"];
// 匹配 Markdown 图片语法的正则: ![alt](url)
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

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

        view.dispatch({
            changes: {
                from: insertFrom,
                to: insertTo,
                insert: text,
            },
            selection: { anchor: insertFrom + text.length },
        });
        view.focus();
    } catch (error) {
        console.error("File paste error:", error);
        globalState.setAlertMessage({
            type: "error",
            message: `处理文件出错: ${error instanceof Error ? error.message : "未知错误"}`,
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
            await uploadAllLocalImages(view);
        } catch (error) {
            console.error("File drop error:", error);
            globalState.setAlertMessage({
                type: "error",
                message: `处理文件出错: ${error instanceof Error ? error.message : "未知错误"}`,
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
        const url = await uploadImageWithCache(file);
        const markdown = `\n![${file.name}](${url})\n`;

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

async function uploadAllLocalImages(view: EditorView) {
    if (!settingsStore.uploadSettings.autoUploadLocal) return;

    globalState.isLoading = true;

    try {
        const original = globalState.getMarkdownText();
        const { text, replaced } = await replaceLocalImagesInMarkdown(original);

        if (!replaced) return;

        globalState.setMarkdownText(text);

        view.dispatch({
            changes: {
                from: 0,
                to: view.state.doc.length,
                insert: text,
            },
        });
    } finally {
        globalState.isLoading = false;
    }
}

async function replaceLocalImagesInMarkdown(markdown: string): Promise<{ text: string; replaced: boolean }> {
    const matches = Array.from(markdown.matchAll(IMAGE_REGEX));
    const localImages = matches.filter((m) => {
        const src = m[2];
        return src && !src.startsWith("http");
    });

    if (localImages.length === 0) {
        return { text: markdown, replaced: false };
    }

    const replaceMap = new Map<string, string>();

    for (const match of localImages) {
        const oldPath = match[2];
        if (replaceMap.has(oldPath)) continue;

        try {
            const url = await uploadImageWithCache(oldPath);
            replaceMap.set(oldPath, url);
        } catch (e) {
            console.error("Image upload failed:", oldPath, e);
            // ⚠️ 不 throw，允许部分成功
        }
    }

    let newText = markdown;
    replaceMap.forEach((url, oldPath) => {
        newText = newText.replaceAll(`](${oldPath})`, `](${url})`);
    });

    return {
        text: newText,
        replaced: replaceMap.size > 0,
    };
}
