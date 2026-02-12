<script lang="ts">
    import { getVersion } from "@tauri-apps/api/app";
    import { type } from "@tauri-apps/plugin-os";
    import { open } from "@tauri-apps/plugin-shell";
    import { onMount } from "svelte";
    import { Modal, WenYanIcon } from "@wenyan-md/ui";
    import { appState } from "$lib/appState.svelte";

    let versionStr = $state("");
    let platform = $state("");

    onMount(async () => {
        platform = type();
        const ver = await getVersion();
        versionStr = `v${ver}`;
    });

    async function openLink(url: string) {
        await open(url);
    }
</script>

<Modal
    isOpen={appState.isShowAboutPage}
    title="关于"
    onClose={() => (appState.isShowAboutPage = false)}
    width="max-w-md"
    isShowHeader={false}
>
    <div class="p-8 flex flex-col items-center gap-6 bg-white dark:bg-gray-900 rounded-lg">
        <div class="flex flex-col items-center gap-3">
            <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-sm">
                <WenYanIcon w="64px" />
            </div>
            <div class="text-center">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">文颜</h2>
                <div
                    class="flex items-center justify-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400 font-mono"
                >
                    <span>{versionStr}</span>
                    <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    <span class="uppercase">{platform}</span>
                </div>
            </div>
        </div>

        <div class="flex gap-6 text-sm">
            <button
                onclick={() => openLink("https://wenyan.yuzhi.tech")}
                class="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path
                        d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                    /></svg
                >
                访问官网
            </button>
            <button
                onclick={() => openLink("https://github.com/caol64/wenyan-pc")}
                class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white hover:underline transition-colors font-medium cursor-pointer"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
                    ><path
                        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                    /></svg
                >
                GitHub
            </button>
        </div>

        <div class="w-full grid grid-cols-2 gap-3 pt-2">
            <button
                onclick={() => openLink("https://yuzhi.tech/contact")}
                class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
                💬 问题反馈
            </button>
            <button
                onclick={() => openLink("https://yuzhi.tech/sponsor")}
                class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-linear-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
                ❤️ 赞助支持
            </button>
        </div>

        <div class="mt-2 text-center pt-6 border-t border-gray-100 dark:border-gray-800 w-full">
            <p class="text-xs text-gray-400 dark:text-gray-500">
                Created by
                <button
                    onclick={() => openLink("https://babyno.top/")}
                    class="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors cursor-pointer"
                >
                    路边的阿不
                </button>
            </p>
            <p class="text-[10px] text-gray-300 dark:text-gray-600 mt-1">
                © 2024-{new Date().getFullYear()} Lei Cao. All rights reserved.
            </p>
        </div>
    </div>
</Modal>
