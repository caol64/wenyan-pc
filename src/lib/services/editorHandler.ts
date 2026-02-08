import type { EditorView } from "@codemirror/view";
import { credentialStore, globalState, settingsStore } from "@wenyan-md/ui";
import { createWechatClient } from "@wenyan-md/core/wechat";
import type { HttpAdapter, MultipartBody } from "@wenyan-md/core/http";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getWechatToken, updateWechatAccessToken } from "../stores/sqliteCredentialStore";

export const tauriHttpAdapter: HttpAdapter = {
    // 1. 直接代理给 Tauri 的 fetch
    fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        return tauriFetch(input as any, init as any);
    },

    // 2. 使用原生 FormData 构建 Multipart
    createMultipart(field: string, file: Blob, filename: string): MultipartBody {
        const form = new FormData();
        form.append(field, file, filename);

        return {
            body: form,
            headers: undefined,
        };
    },
};

const imgType = ["image/bmp", "image/png", "image/jpeg", "image/gif", "video/mp4"];
const { uploadMaterial, fetchAccessToken } = createWechatClient(tauriHttpAdapter);

export async function defaultEditorPasteHandler(event: ClipboardEvent, view: EditorView) {
    const files = event.clipboardData?.files;
    if (files && files.length > 0 && canHandleFile(files[0])) {
        event.preventDefault();
        await handleImageUpload(files[0], view);
    }
}

export async function defaultEditorDropHandler(event: DragEvent, view: EditorView) {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const extension = getFileExtension(file.name).toLowerCase();
    const isMarkdown = extension === "md" || file.type === "text/markdown";

    if (canHandleFile(file)) {
        event.preventDefault();
        await handleImageUpload(file, view);
    } else if (isMarkdown) {
        event.preventDefault();
        try {
            const content = await readFileAsText(file);
            globalState.setMarkdownText(content);
        } catch (error) {
            console.error("File drop error:", error);
            globalState.setAlertMessage({
                type: "error",
                message: `处理文件出错: ${error instanceof Error ? error.message : "未知错误"}`,
            });
        }
    }
}

function canHandleFile(file: File): boolean {
    return file && imgType.includes(file.type);
}

function checkUploadEnabed(): boolean {
    const imageHostEnabled = settingsStore.enabledImageHost === "wechat";
    if (!imageHostEnabled) {
        throw new Error("请先在设置中启用微信图床");
    }
    return true;
}

function checkCredential(): boolean {
    const credential = credentialStore.getCredential("wechat");
    if (!credential || !credential.appId || !credential.appSecret) {
        throw new Error("请先在设置中配置微信的凭据");
    }
    return true;
}

async function auth(): Promise<string> {
    const credential = credentialStore.getCredential("wechat");
    const credentialDO = await getWechatToken();
    const storedAccessToken = credentialDO!.accessToken;
    const expireTime = credentialDO!.expireTime;
    if (!storedAccessToken || (expireTime && Date.now() > expireTime)) {
        const data = await fetchAccessToken(credential.appId!, credential.appSecret!);
        if ((data as any).errcode) {
            throw new Error(`获取 Access Token 失败，错误码：${data.errcode}，${data.errmsg}`);
        }
        if (!data.access_token) {
            throw new Error(`获取 Access Token 失败: ${data}`);
        }
        if (data.access_token && data.expires_in) {
            data.expires_in = Date.now() + data.expires_in * 1000;
        }
        await updateWechatAccessToken(data.access_token, data.expires_in);
        return data.access_token;
    }
    return storedAccessToken;
}

async function handleImageUpload(file: File, view: EditorView) {
    const selectionSnapshot = view.state.selection.main;
    const insertFrom = selectionSnapshot.from;
    const insertTo = selectionSnapshot.to;
    try {
        if (checkUploadEnabed() && checkCredential()) {
            globalState.isLoading = true;
            const accessToken = await auth();
            const data = await uploadMaterial("image", file, file.name, accessToken);
            if ((data as any).errcode) {
                throw new Error(`上传失败，错误码：${(data as any).errcode}，错误信息：${(data as any).errmsg}`);
            }
            const url = data.url;
            const mediaId = data.media_id;
            // 在光标位置插入图片链接
            const markdownImage = `\n![${file.name}](${url})\n`;
            view.dispatch({
                changes: {
                    from: insertFrom,
                    to: insertTo,
                    insert: markdownImage,
                },
                // 插入后，将新的光标位置定位到图片后面
                selection: { anchor: insertFrom + markdownImage.length },
            });
            view.focus();
        }
    } catch (error) {
        console.error("图片上传失败:", error);
        globalState.setAlertMessage({
            type: "error",
            message: `${error instanceof Error ? error.message : error}`,
        });
    } finally {
        globalState.isLoading = false;
    }
}

function getFileExtension(filename: string): string {
    if (!filename || typeof filename !== "string") {
        return "";
    }
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1 || lastDotIndex === 0) {
        return "";
    }
    return filename.slice(lastDotIndex + 1);
}

function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}
