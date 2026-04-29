import { type FileSystemAdapter, type FileEntry, filterAndSortEntries } from "@wenyan-md/ui";
import { readDirectory, selectDirDialog } from "./bridge/system";

export const bridgeFsAdapter: FileSystemAdapter = {
    async readDir(path: string): Promise<FileEntry[]> {
        const entries = await readDirectory(path);
        return filterAndSortEntries(
            entries.map((e) => ({
                name: e.name,
                path: e.path,
                isDirectory: e.isDir,
            })),
        );
    },
    async openDirectoryPicker(): Promise<string | null> {
        return await selectDirDialog();
    },
};
