import { listen } from "@tauri-apps/api/event";

export function initFileOpenListener(onOpen: (file: string) => void) {
    listen<string>("open-file", (event) => {
        const filePath = event.payload;
        // console.log("Open file from system:", filePath);
        onOpen(filePath);
    });
}
