import { open } from "@tauri-apps/plugin-shell";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { appState } from "./appState.svelte";
import {
    setPreviewClick,
    setCopyClick,
    setEditorClick,
    setEditorDrop,
    setEditorPaste,
    setUploadHelpClick,
    setResetTokenClick,
    setExportImageClick,
    setImageProcessorAction,
    setPublishArticleClick,
    setAutoCacheChangeClick,
    setImportCssClick,
    globalState,
    themeStore,
    setHandleFileOpen,
    defaultPublishHandler,
    setGetWenyanElement,
    setPublishArticleToDraft,
    setUploadImage,
    setPublishHelpClick,
    defaultEditorPasteHandler,
    defaultEditorDropHandler,
    setHandleMarkdownContent,
    setMarkdownFileDrop,
    setUploadBlobImage,
} from "@wenyan-md/ui";
import { resetWechatAccessToken } from "$lib/stores/sqliteCredentialStore";
import { exportImage } from "$lib/services/exportHandler";
import { imageProcessorAction } from "./imageProcessor.svelte";
import { copyHandler } from "$lib/services/copyHandler";
import { sqliteUploadCacheStore } from "./stores/sqliteUploadCacheStore";
import { handleFileOpen } from "./services/fileOpenHandler";
import { getWenyanElement } from "./utils";
import { publishArticleToDraft } from "./services/wechatHandler";
import { uploadImage, uploadBlobImageWithCache } from "./services/imageUploadService";
import { handleMarkdownContent } from "./services/markdownContentHandler";
import { updateLastArticlePath } from "./stores/sqliteArticleStore";
import type { WechatUploadResponse } from "@wenyan-md/core/wechat";

export function setHooks() {
    setCopyClick(copyHandler);
    setEditorPaste(defaultEditorPasteHandler);
    setEditorDrop(defaultEditorDropHandler);
    setPreviewClick(closeMoreMenu);
    setEditorClick(closeMoreMenu);
    setUploadHelpClick(uploadHelpClick);
    setResetTokenClick(resetWechatAccessToken);
    setExportImageClick(exportImage);
    setImageProcessorAction(imageProcessorAction);
    setPublishArticleClick(defaultPublishHandler);
    setAutoCacheChangeClick(autoCacheChangeHandler);
    setImportCssClick(importCssHandler);
    setHandleFileOpen(handleFileOpen); // 处理从目录树中打开文件的逻辑
    setGetWenyanElement(getWenyanElement);
    setPublishArticleToDraft(publishArticleToDraft);
    setUploadImage(uploadImageHook); // 点击发布按钮后，处理文章内容中的单个图片上传
    setPublishHelpClick(publishHelpClick);
    setHandleMarkdownContent(handleMarkdownContent); // 编辑器内粘贴文本或拖拽 Markdown 文件时，处理其中的图片
    setMarkdownFileDrop(onMarkdownFileDrop);
    setUploadBlobImage(uploadBlobImageWithCache); // 处理编辑器内粘贴或拖拽的图片（Blob 对象）
}

async function uploadHelpClick() {
    await open("https://yuzhi.tech/docs/wenyan/upload");
}

async function publishHelpClick() {
    await open("https://yuzhi.tech/docs/wenyan/publish");
}

function closeMoreMenu() {
    appState.isShowMoreMenu = false;
}

function autoCacheChangeHandler() {
    sqliteUploadCacheStore.clear();
}

async function importCssHandler(url: string, name: string) {
    const resp = await tauriFetch(url);
    if (!resp.ok) {
        globalState.setAlertMessage({
            type: "error",
            title: "导入 CSS 失败",
            message: `无法从 ${url} 获取 CSS 文件。`,
        });
        return;
    }
    const cssText = await resp.text();
    const themeId = globalState.getCurrentThemeId();
    themeStore.addCustomTheme(`0:${themeId}`, name);
    const currentTheme = globalState.getCurrentTheme();
    currentTheme.name = name;
    currentTheme.css = cssText;
    currentTheme.id = `0:${themeId}`;
    globalState.customThemeName = name;
}

async function onMarkdownFileDrop() {
    await updateLastArticlePath(null, null, null);
}

async function uploadImageHook(imageUrl: string): Promise<WechatUploadResponse> {
    try {
        return await uploadImage(imageUrl);
    } catch (error) {
        globalState.setAlertMessage({
            type: "error",
            message: `图片上传失败: ${error instanceof Error ? error.message : String(error)}`,
        });
        return { url: imageUrl, media_id: "" }; // 返回原 URL，继续发布流程，但不设置 media_id
    }
}
