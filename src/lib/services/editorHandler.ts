import type { EditorView } from "@codemirror/view";
import { globalState, settingsStore } from "@wenyan-md/ui";
import { getFileExtension, readFileAsText } from "$lib/utils";
import { uploadLocalImageWithCache, uploadMemImageWithCache, uploadNetworkImageWithCache } from "./imageUploadService";

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
            const { text } = await replaceLocalImagesInMarkdown(content);
            const { text: finalText } = await replaceNetworkImagesInMarkdown(text);

            view.dispatch({
                changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: finalText,
                },
            });
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

async function replaceImagesInMarkdown(
    markdown: string,
    predicate: (src: string) => boolean,
    uploader: (src: string) => Promise<{ url: string }>,
): Promise<{ text: string; replaced: boolean }> {
    const matches = Array.from(markdown.matchAll(IMAGE_REGEX));

    const targetImages = matches.filter((m) => {
        const src = m[2];
        return src && predicate(src);
    });

    if (targetImages.length === 0) {
        return { text: markdown, replaced: false };
    }

    const replaceMap = new Map<string, string>();

    for (const match of targetImages) {
        const oldSrc = match[2];

        if (replaceMap.has(oldSrc)) continue;

        try {
            const resp = await uploader(oldSrc);
            replaceMap.set(oldSrc, resp.url);
        } catch (e) {
            console.error("Image upload failed:", oldSrc, e);
            // 允许部分成功
        }
    }

    let newText = markdown;

    replaceMap.forEach((newUrl, oldSrc) => {
        newText = newText.replaceAll(`](${oldSrc})`, `](${newUrl})`);
    });

    return {
        text: newText,
        replaced: replaceMap.size > 0,
    };
}

function replaceLocalImagesInMarkdown(markdown: string) {
    if (!settingsStore.uploadSettings.autoUploadLocal) {
        return { text: markdown, replaced: false };
    }
    return replaceImagesInMarkdown(markdown, (src) => !src.startsWith("http"), uploadLocalImageWithCache);
}

function replaceNetworkImagesInMarkdown(markdown: string) {
    if (!settingsStore.uploadSettings.autoUploadNetwork) {
        return { text: markdown, replaced: false };
    }
    return replaceImagesInMarkdown(markdown, (src) => src.startsWith("http"), uploadNetworkImageWithCache);
}
