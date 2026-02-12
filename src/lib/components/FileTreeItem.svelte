<script lang="ts">
    import { readDir } from "@tauri-apps/plugin-fs";
    import { join } from "@tauri-apps/api/path";
    import type { FileEntry } from "$lib/types";
    import Self from "./FileTreeItem.svelte";

    let {
        entry,
        depth = 0,
        onFileClick,
    }: { entry: FileEntry; depth?: number; onFileClick?: (file: FileEntry) => void } = $props();

    let isOpen = $state(false);
    let children = $state<FileEntry[]>([]);
    let isLoading = $state(false);

    // 排序：文件夹在前，文件在后
    function sortEntries(entries: FileEntry[]) {
        return entries.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) {
                return a.name.localeCompare(b.name);
            }
            return a.isDirectory ? -1 : 1;
        });
    }

    async function toggleOpen() {
        if (!entry.isDirectory) {
            onFileClick?.(entry);
            return;
        }

        isOpen = !isOpen;

        // 如果展开且没有加载过子节点，则读取目录
        if (isOpen && children.length === 0) {
            isLoading = true;
            try {
                const entries = await readDir(entry.path);
                const mappedEntries: FileEntry[] = await Promise.all(
                    entries.map(async (e) => ({
                        name: e.name,
                        path: await join(entry.path, e.name),
                        isDirectory: e.isDirectory,
                    })),
                );
                const filteredEntries = mappedEntries.filter((e) => {
                    if (e.isDirectory) return true;
                    return e.name.toLowerCase().endsWith(".md");
                });
                children = sortEntries(filteredEntries);
            } catch (error) {
                console.error("Failed to read dir:", error);
            } finally {
                isLoading = false;
            }
        }
    }
</script>

<div>
    <!-- 文件/文件夹 行 -->
    <button
        class="cursor-pointer flex w-full items-center gap-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-sm text-left transition-colors truncate"
        style="padding-left: {depth * 12 + 8}px"
        onclick={toggleOpen}
    >
        <!-- 图标区 -->
        <span class="text-gray-500 shrink-0">
            {#if isLoading}
                <!-- Loading Spinner -->
                <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
            {:else if entry.isDirectory}
                <!-- Folder Icon -->
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 {isOpen ? 'text-blue-500' : ''}"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                </svg>
            {:else}
                <!-- File Icon -->
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
            {/if}
        </span>

        <span class="truncate text-gray-700 dark:text-gray-300 select-none">
            {entry.name}
        </span>
    </button>

    <!-- 递归渲染子节点 -->
    {#if isOpen && entry.isDirectory}
        <div class="flex flex-col">
            {#each children as child (child.path)}
                <Self entry={child} depth={depth + 1} {onFileClick} />
            {/each}
        </div>
    {/if}
</div>
