<script lang="ts">
    import { onMount, setContext } from "svelte";
    import TitleBar from "$lib/components/TitleBar.svelte";
    import { readExampleArticle, writeHtmlToClipboard, writeTextToClipboard } from "$lib/utils";
    import { getCurrentWindow } from "@tauri-apps/api/window";
    import {
        globalState,
        MainPage,
        Sidebar,
        themeStore,
        settingsStore,
        localStorageSettingsAdapter,
        COPY_CONTEXT_KEY,
        GET_WENYAN_ELEMENT_CONTEXT_KEY,
        type CopyContentType,
        articleStore,
    } from "@wenyan-md/ui";
    import { sqliteThemeStorageAdapter } from "$lib/themeStore";
    import { sqliteArticleStorageAdapter } from "$lib/articleStore";

    let isShowMoreMenu = $state(false);

    function getWenyanElement(): HTMLElement {
        const wenyanElement = document.getElementById("wenyan");
        if (!wenyanElement) {
            throw new Error("Wenyan element not found");
        }
        const clonedWenyan = wenyanElement.cloneNode(true) as HTMLElement;
        // 清理样式以确保复制的内容干净
        // [clonedWenyan, ...clonedWenyan.querySelectorAll("*")].forEach((el) => {
        //     el.removeAttribute("class");
        //     el.removeAttribute("style");
        // });
        return clonedWenyan;
    }

    function handleCopy(result: string, contentType: CopyContentType) {
        if (contentType === "html") {
            writeHtmlToClipboard(result);
        } else {
            writeTextToClipboard(result);
        }
    }

    setContext(COPY_CONTEXT_KEY, handleCopy);
    setContext(GET_WENYAN_ELEMENT_CONTEXT_KEY, getWenyanElement);

    onMount(async () => {
        await themeStore.register(sqliteThemeStorageAdapter);
        await settingsStore.register(localStorageSettingsAdapter);
        await articleStore.register(sqliteArticleStorageAdapter);
        globalState.setMarkdownText(await getArticle());
        globalState.setPlatform("wechat");
    });

    function toggleMoreMenu() {
        isShowMoreMenu = !isShowMoreMenu;
    }

    function onAboutClick() {
        getCurrentWindow().emit("open-about");
    }

    async function getArticle(): Promise<string> {
        const article = articleStore.getLastArticle();
        return article ? article : await readExampleArticle();
    }
</script>

<div class="flex h-screen w-full flex-col overflow-hidden relative">
    <TitleBar showMoreMenu={toggleMoreMenu} />
    <div class="flex h-full w-full flex-col overflow-hidden md:flex-row">
        <MainPage />

        {#if globalState.judgeSidebarOpen()}
            <div class="h-full w-80">
                <Sidebar />
            </div>
        {/if}
    </div>

    {#if isShowMoreMenu}
        <div
            class="absolute w-40 top-8 right-5 justify-start flex flex-col gap-2.5 items-start transition-opacity duration-300 rounded-md outline-none shadow-md p-2 bg-[#f9f9f9] dark:bg-gray-700 z-50"
        >
            <button onclick={onAboutClick} class="p-2 cursor-pointer">关于</button>
        </div>
    {/if}
</div>
