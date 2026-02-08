<script lang="ts">
    import { open } from "@tauri-apps/plugin-shell";
    import { onMount } from "svelte";
    import TitleBar from "$lib/components/TitleBar.svelte";
    import { loadMarkdownFromPath, readExampleArticle, writeHtmlToClipboard, writeTextToClipboard } from "$lib/utils";
    import { getCurrentWindow } from "@tauri-apps/api/window";
    import {
        globalState,
        MainPage,
        Sidebar,
        themeStore,
        settingsStore,
        localStorageSettingsAdapter,
        type CopyContentType,
        articleStore,
        AlertModal,
        SettingsModal,
        setPreviewClick,
        setCopyClick,
        setEditorClick,
        setEditorDrop,
        setEditorPaste,
        setUploadHelpClick,
        credentialStore,
        setDownloadImageToBase64,
        setResetTokenClick,
        ConfirmModal,
        setExportImageClick,
    } from "@wenyan-md/ui";
    import { sqliteThemeStorageAdapter } from "$lib/stores/sqliteThemeStore";
    import { sqliteArticleStorageAdapter } from "$lib/stores/sqliteArticleStore";
    import { resetWechatAccessToken, sqliteCredentialStoreAdapter } from "$lib/stores/sqliteCredentialStore";
    import { defaultEditorDropHandler, defaultEditorPasteHandler } from "$lib/services/editorHandler";
    import SimpleLoader from "$lib/components/SimpleLoader.svelte";
    import { downloadImage } from "$lib/imageProxy";
    import { exportImage } from "$lib/services/exportHandler";
    import { initFileOpenListener } from "$lib/fileOpenListener";

    let isShowMoreMenu = $state(false);
    let isShowSettingsPage = $state(false);

    function handleCopy(result: string, contentType: CopyContentType) {
        if (contentType === "html") {
            writeHtmlToClipboard(result);
        } else {
            writeTextToClipboard(result);
        }
    }

    setCopyClick(handleCopy);
    setEditorPaste(defaultEditorPasteHandler);
    setEditorDrop(defaultEditorDropHandler);
    setPreviewClick(closeMoreMenu);
    setEditorClick(closeMoreMenu);
    setUploadHelpClick(uploadHelpClick);
    setDownloadImageToBase64(downloadImage);
    setResetTokenClick(resetWechatAccessToken);
    setExportImageClick(exportImage);

    onMount(async () => {
        await themeStore.register(sqliteThemeStorageAdapter);
        await settingsStore.register(localStorageSettingsAdapter);
        await articleStore.register(sqliteArticleStorageAdapter);
        await credentialStore.register(sqliteCredentialStoreAdapter);
        globalState.setMarkdownText(await getArticle());
        globalState.setPlatform("wechat");

        initFileOpenListener(async (filePath) => {
            // console.log("Loading new markdown:", filePath);
            const content = await loadMarkdownFromPath(filePath);
            globalState.setMarkdownText(content);
        });
    });

    function toggleMoreMenu() {
        isShowMoreMenu = !isShowMoreMenu;
    }

    function onAboutClick() {
        closeMoreMenu();
        getCurrentWindow().emit("open-about");
    }

    async function getArticle(): Promise<string> {
        const article = articleStore.getLastArticle();
        return article ? article : await readExampleArticle();
    }

    function closeMoreMenu() {
        isShowMoreMenu = false;
    }

    function showSettingsPage() {
        closeMoreMenu();
        isShowSettingsPage = true;
    }

    async function uploadHelpClick() {
        await open("https://yuzhi.tech/docs/wenyan/upload");
    }
</script>

<div class="flex h-screen w-full flex-col overflow-hidden relative">
    <TitleBar showMoreMenu={toggleMoreMenu} />
    <div class="flex h-full w-full flex-col overflow-hidden md:flex-row relative">
        <MainPage />

        {#if globalState.judgeSidebarOpen()}
            <div class="h-full w-80">
                <Sidebar />
            </div>
        {/if}

        {#if globalState.isLoading}
            <SimpleLoader />
        {/if}
    </div>

    {#if isShowMoreMenu}
        <div
            class="absolute w-40 top-8 right-5 justify-start flex flex-col items-start transition-opacity duration-300 rounded-md outline-none shadow-md p-2 bg-[#f9f9f9] dark:bg-gray-700 z-50"
        >
            <button onclick={showSettingsPage} class="p-2 cursor-pointer">设置</button>
            <button onclick={onAboutClick} class="p-2 cursor-pointer">关于</button>
        </div>
    {/if}
</div>

<AlertModal />
<ConfirmModal />
<SettingsModal isOpen={isShowSettingsPage} onClose={() => (isShowSettingsPage = false)} />
