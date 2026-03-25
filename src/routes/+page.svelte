<script lang="ts">
    import { onMount } from "svelte";
    import TitleBar from "$lib/components/TitleBar.svelte";
    import { getDefaultArticle } from "$lib/utils";
    import { appState } from "$lib/appState.svelte";
    import {
        globalState,
        MainPage,
        Sidebar,
        AlertModal,
        SettingsModal,
        ConfirmModal,
        CreateThemeModal,
        SimpleLoader,
        FileSidebar,
    } from "@wenyan-md/ui";
    import { handleFileOpen, initFileOpenListener } from "$lib/services/fileOpenHandler";
    import { setHooks } from "$lib/setHooks";
    import { registerStore } from "$lib/storeRegister";
    import AboutPage from "$lib/components/AboutPage.svelte";
    import { tauriFsAdapter } from "$lib/tauriFsAdapter";

    setHooks();
    onMount(async () => {
        await registerStore();
        globalState.setMarkdownText(await getDefaultArticle());
        globalState.setPlatform("wechat");

        initFileOpenListener(async (filePath) => {
            await handleFileOpen(filePath);
        });
    });

    function toggleMoreMenu() {
        appState.isShowMoreMenu = !appState.isShowMoreMenu;
    }

    function onAboutClick() {
        appState.isShowAboutPage = true;
    }

    function showSettingsPage() {
        appState.isShowSettingsPage = true;
    }
</script>

<div class="flex h-screen w-full flex-col overflow-hidden relative">
    <TitleBar showMoreMenu={toggleMoreMenu} />
    <div class="flex h-full w-full flex-col overflow-hidden md:flex-row relative">
        {#if globalState.isShowFileSidebar}
            <FileSidebar fsAdapter={tauriFsAdapter} />
        {/if}
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

    {#if appState.isShowMoreMenu}
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
<SettingsModal isOpen={appState.isShowSettingsPage} onClose={() => (appState.isShowSettingsPage = false)} />
<AboutPage />
<CreateThemeModal
    isOpen={globalState.isShowCreateThemeModal}
    onClose={() => (globalState.isShowCreateThemeModal = false)}
/>
