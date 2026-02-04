<script lang="ts">
    import { WenYanIcon } from "@wenyan-md/ui";
    import { getVersion } from "@tauri-apps/api/app";
    import { type } from "@tauri-apps/plugin-os";
    import { open } from "@tauri-apps/plugin-shell";
    import { onMount } from "svelte";

    let versionStr = $state("");

    onMount(async () => {
        const currentPlatform = type();
        const version = await getVersion();
        versionStr = `版本：${currentPlatform} v${version}`;
    });

    async function onclickSponsor() {
        await open("https://yuzhi.tech/sponsor");
    }

    async function onclickContact() {
        await open("https://yuzhi.tech/contact");
    }
</script>

<div class="overflow-hidden flex flex-col items-center justify-center h-screen gap-2 text-xs">
    <WenYanIcon w="48px" />
    <p>{versionStr}</p>
    <div>
        问题反馈：
        <button class="cursor-pointer text-blue-400" onclick={onclickContact}>
            https://yuzhi.tech/contact
        </button>
    </div>
    <div>
        ❤️打赏：
        <button class="cursor-pointer text-blue-400" onclick={onclickSponsor}>
            https://yuzhi.tech/sponsor
        </button>
    </div>
    <p>© 2024-2026 Lei Cao. All rights reserved.</p>
</div>
