import type { EditorView } from "codemirror";
import { credentialStore, globalState, settingsStore } from "@wenyan-md/ui";
import { createWechatClient, type HttpAdapter, type MultipartBody } from "@wenyan-md/core/wechat";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

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
    const files = event.dataTransfer?.files;
    if (files && files.length > 0 && canHandleFile(files[0])) {
        event.preventDefault();
        await handleImageUpload(files[0], view);
    }
}

function canHandleFile(file: File) {
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
    const storedAccessToken = credential.accessToken;
    const expireTime = credential.expireTime;
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
        credentialStore.saveCredentialDirect("wechat", { accessToken: data.access_token, expireTime: data.expires_in });
        return data.access_token;
    }
    return storedAccessToken;
}

async function handleImageUpload(file: File, view: EditorView) {
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
            const markdownImage = `![${file.name}](${url})`;
            const { from, to } = view.state.selection.main;
            view.dispatch({
                changes: { from, to, insert: markdownImage },
                selection: { anchor: from + markdownImage.length },
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
