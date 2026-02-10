import { credentialStore, settingsStore } from "@wenyan-md/ui";
import { getWechatToken, updateWechatAccessToken } from "../stores/sqliteCredentialStore";
import { createWechatClient, type WechatPublishOptions, type WechatUploadResponse } from "@wenyan-md/core/wechat";
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
const { uploadMaterial, fetchAccessToken, publishArticle } = createWechatClient(tauriHttpAdapter);

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
    const appid = credential.appId!;
    const secret = credential.appSecret!;
    const credentialDO = await getWechatToken();
    if (credentialDO && credentialDO.accessToken && credentialDO.expireTime) {
        const storedAccessToken = credentialDO.accessToken;
        const expireTime = credentialDO.expireTime;
        if (Date.now() < expireTime) {
            return storedAccessToken;
        }
    }
    const data = await fetchAccessToken(appid, secret);
    if (data.access_token && data.expires_in) {
        data.expires_in = Date.now() + data.expires_in * 1000;
    }
    await updateWechatAccessToken(data.access_token, data.expires_in);
    return data.access_token;
}

export async function uploadFileCore(file: Blob | File, fileName: string): Promise<WechatUploadResponse> {
    if (checkUploadEnabed() && checkCredential()) {
        const accessToken = await auth();
        return await uploadMaterial("image", file, fileName, accessToken);
    }
    throw new Error("上传条件未满足");
}

export async function publishArticleToDraft(publishOption: WechatPublishOptions): Promise<string> {
    if (checkUploadEnabed() && checkCredential()) {
        const accessToken = await auth();
        const data = await publishArticle(accessToken, publishOption);
        return data.media_id;
    }
    throw new Error("发布条件未满足");
}
