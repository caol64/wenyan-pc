import { writeToClipboard, pathToBase64 } from "./bridge/system";
import { getDefaultArticle as getDefaultArticleFromBridge } from "./bridge/article";

export async function writeHtmlToClipboard(html: string): Promise<void> {
    await writeToClipboard("", html);
}

export async function writeTextToClipboard(text: string): Promise<void> {
    await writeToClipboard(text);
}

export async function readExampleArticle(): Promise<string> {
    return await getDefaultArticleFromBridge();
}

export async function getDefaultArticle(): Promise<string> {
    return await getDefaultArticleFromBridge();
}

export function getWenyanElement(): HTMLElement {
    const wenyanElement = document.getElementById("wenyan");
    if (!wenyanElement) {
        throw new Error("Wenyan element not found");
    }
    const clonedWenyan = wenyanElement.cloneNode(true) as HTMLElement;
    clonedWenyan.querySelectorAll("img").forEach(async (element) => {
        const dataSrc = element.getAttribute("data-src");
        if (dataSrc) {
            element.src = dataSrc;
        }
    });
    return clonedWenyan;
}

export async function downloadImageToBase64(url: string): Promise<string> {
    const base64 = await pathToBase64(url);
    if (!base64) {
        throw new Error(`Failed to convert image to base64: ${url}`);
    }
    return base64;
}
