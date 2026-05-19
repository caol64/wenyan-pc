import { invokeBridge } from "./invoke";

export interface DirEntry {
    name: string;
    path: string;
    isDir: boolean;
}

export async function readDirectory(path: string): Promise<DirEntry[]> {
    return await invokeBridge("read_directory", { path });
}

export async function saveImage(data: Uint8Array, defaultPath?: string): Promise<string | null> {
    return await invokeBridge("save_image", { data, defaultPath });
}

export async function selectDirDialog(): Promise<string | null> {
    return await invokeBridge("select_dir_dialog");
}

export async function writeToClipboard(text: string, html?: string): Promise<void> {
    await invokeBridge("write_to_clipboard", { text, html });
}

export async function pathToBase64(path: string): Promise<string | null> {
    return await invokeBridge("path_to_base64", { path });
}

export async function fetchText(url: string): Promise<string> {
    return await invokeBridge("fetch_text", { url });
}

export async function openExternal(url: string): Promise<void> {
    await invokeBridge("open_external", { url });
}

export async function osType(): Promise<string> {
    return await invokeBridge("os_type");
}
