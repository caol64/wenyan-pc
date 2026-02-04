<script lang="ts">
    import { PlatformButtons, Win32WindowButtons, WenYanButton } from "@wenyan-md/ui";
    import { getCurrentWindow } from "@tauri-apps/api/window";

    let { showMoreMenu }: { showMoreMenu: () => void } = $props();

    function minimizeWindow() {
        const window = getCurrentWindow();
        window.minimize();
    }

    function maximizeWindow() {
        const window = getCurrentWindow();
        window.maximize();
    }

    function closeWindow() {
        const window = getCurrentWindow();
        window.close();
    }
</script>

<div data-tauri-drag-region class="h-7.5 flex justify-between items-center bg-gray-200 dark:bg-gray-700">
    <div class="flex flex-row gap-2 justify-center items-center px-4">
        <WenYanButton w="20px" />
        <span class="text-xs font-bold select-none">文颜</span>
    </div>
    <div class="flex gap-4">
        <PlatformButtons />
        <button
            class="inline-flex h-7.5 w-7.5 cursor-pointer items-center justify-center border-none bg-gray-200 hover:bg-white dark:bg-gray-700 transition-colors"
            onclick={showMoreMenu}
            aria-label="showMoreMenu"
        >
            <svg width="16px" height="16px" viewBox="0 0 48 48" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="12" r="3" fill="#currentColor" />
                <circle cx="24" cy="24" r="3" fill="#currentColor" />
                <circle cx="24" cy="35" r="3" fill="#currentColor" />
            </svg>
        </button>
        <Win32WindowButtons {minimizeWindow} {maximizeWindow} {closeWindow} />
    </div>
</div>
