import { invoke } from "@tauri-apps/api/core";

export interface DirEntry {
    name: string;
    path: string;
    isDir: boolean;
}

export async function readDirectory(path: string): Promise<DirEntry[]> {
    return await invoke("read_directory", { path });
}

export async function unpackFilePath(path: string): Promise<{ fileName: string; dir: string }> {
    const [fileName, dir] = await invoke<[string, string]>("unpack_file_path", { path });
    return { fileName, dir };
}

export async function resolvePath(path: string, base?: string): Promise<string> {
    return await invoke("resolve_path", { path, base });
}

export async function saveImage(data: Uint8Array, defaultPath?: string): Promise<string | null> {
    return await invoke("save_image", { data, defaultPath });
}

export async function openFileDialog(): Promise<string | null> {
    return await invoke("open_file_dialog");
}

export async function selectDirDialog(): Promise<string | null> {
    return await invoke("select_dir_dialog");
}

export async function isAbsolutePath(path: string): Promise<boolean> {
    return await invoke("is_absolute_path", { path });
}

export async function writeToClipboard(text: string, html?: string): Promise<void> {
    await invoke("write_to_clipboard", { text, html });
}

export async function getFileMd5(path: string): Promise<string> {
    return await invoke("get_file_md5", { path });
}

export async function getDataMd5(data: Uint8Array): Promise<string> {
    return await invoke("get_data_md5", { data });
}

export async function downloadImage(url: string): Promise<Uint8Array> {
    const resp = await invoke<number[]>("download_image", { url });
    return new Uint8Array(resp);
}

export async function fetchText(url: string): Promise<string> {
    return await invoke("fetch_text", { url });
}

export async function openExternal(url: string): Promise<void> {
    await invoke("open_external", { url });
}
