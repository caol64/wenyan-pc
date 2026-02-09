import { credentialStore, settingsStore } from "@wenyan-md/ui";
import { getWechatToken, updateWechatAccessToken } from "../stores/sqliteCredentialStore";
import { createWechatClient } from "@wenyan-md/core/wechat";
import type { HttpAdapter, MultipartBody } from "@wenyan-md/core/http";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

const tauriHttpAdapter: HttpAdapter = {
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
const { uploadMaterial, fetchAccessToken } = createWechatClient(tauriHttpAdapter);

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

export async function uploadFileCore(file: Blob | File, fileName: string): Promise<string> {
    if (checkUploadEnabed() && checkCredential()) {
        const accessToken = await auth();
        const data = await uploadMaterial("image", file, fileName, accessToken);

        if ((data as any).errcode) {
            throw new Error(`上传失败 [${(data as any).errcode}]: ${(data as any).errmsg}`);
        }

        return data.url;
    }
    throw new Error("上传条件未满足");
}
