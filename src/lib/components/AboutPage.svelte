<script lang="ts">
    import { getVersion } from "@tauri-apps/api/app";
    import { type } from "@tauri-apps/plugin-os";
    import { open } from "@tauri-apps/plugin-shell";
    import { onMount } from "svelte";
    import { GithubButton, Modal } from "@wenyan-md/ui";
    import { appState } from "$lib/appState.svelte";
    import { WenYanIcon } from "@wenyan-md/ui";

    let title = $state("关于");
    let versionStr = $state("");

    onMount(async () => {
        const currentPlatform = type();
        const version = await getVersion();
        versionStr = `${currentPlatform} v${version}`;
    });

    async function onclickSponsor() {
        await open("https://yuzhi.tech/sponsor");
    }

    async function onclickContact() {
        await open("https://yuzhi.tech/contact");
    }

    async function onclickHomepage() {
        await open("https://babyno.top/");
    }

    async function onclickGithub() {
        await open("https://github.com/caol64/wenyan-pc");
    }
</script>

<Modal
    isOpen={appState.isShowAboutPage}
    {title}
    onClose={() => (appState.isShowAboutPage = false)}
    width="max-w-xl"
    isShowHeader={false}
>
    <div class="p-6 flex flex-col gap-6 rounded-b">
        <div class="m-auto"><WenYanIcon w="48px" /></div>
        <div class="text-center space-y-2 text-gray-700 dark:text-gray-300">
            <p class="text-base">
                <span class="font-semibold">文颜：</span>
                <span>{versionStr}</span>
            </p>
            <button onclick={onclickHomepage} class="text-blue-600 dark:text-blue-500 hover:underline cursor-pointer"
                >路边的阿不</button
            >
        </div>

        <div class="flex flex-wrap gap-4 items-center justify-center">
            <button
                onclick={onclickContact}
                class="inline-flex items-center justify-center px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer"
            >
                问题反馈
            </button>
            <button
                onclick={onclickSponsor}
                class="inline-flex items-center justify-center px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 transition cursor-pointer"
            >
                赞助
            </button>
            <GithubButton onClick={onclickGithub} />
        </div>

        <p class="text-center text-sm text-gray-400 dark:text-gray-500">© 2024-2026 Lei Cao. All rights reserved.</p>
    </div>
</Modal>
