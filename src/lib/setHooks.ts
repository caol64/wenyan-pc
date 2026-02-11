import { open } from "@tauri-apps/plugin-shell";
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
} from "@wenyan-md/ui";
import { resetWechatAccessToken } from "$lib/stores/sqliteCredentialStore";
import { defaultEditorDropHandler, defaultEditorPasteHandler } from "$lib/services/editorHandler";
import { exportImage } from "$lib/services/exportHandler";
import { imageProcessorAction } from "$lib/services/processImages.svelte";
import { publishHandler } from "$lib/services/publishHandler";
import { copyHandler } from "$lib/services/copyHandler";
import { sqliteUploadCacheStore } from "./stores/sqliteUploadCacheStore";

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
    setPublishArticleClick(publishHandler);
    setAutoCacheChangeClick(autoCacheChangeHandler);
}

async function uploadHelpClick() {
    await open("https://yuzhi.tech/docs/wenyan/upload");
}

function closeMoreMenu() {
    appState.isShowMoreMenu = false;
}

function autoCacheChangeHandler() {
    sqliteUploadCacheStore.clear();
}
