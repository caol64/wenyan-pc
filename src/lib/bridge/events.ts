import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export async function onOpenFile(handler: (path: string) => void): Promise<UnlistenFn> {
    return await listen<string>("open-file", (event) => {
        handler(event.payload);
    });
}
