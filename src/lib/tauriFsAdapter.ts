import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { filterAndSortEntries, type FileEntry, type FileSystemAdapter } from "@wenyan-md/ui";

export const tauriFsAdapter: FileSystemAdapter = {
    async openDirectoryPicker(): Promise<string | null> {
        const selected = await open({
            directory: true,
            multiple: false,
            title: "选择工作目录",
        });
        return typeof selected === "string" ? selected : null;
    },

    async readDir(path: string): Promise<FileEntry[]> {
        const entries = await readDir(path);
        const mappedEntries: FileEntry[] = await Promise.all(
            entries.map(async (e) => ({
                name: e.name,
                path: await join(path, e.name),
                isDirectory: e.isDirectory,
            })),
        );
        return filterAndSortEntries(mappedEntries);
    },
};
