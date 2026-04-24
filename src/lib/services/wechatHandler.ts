import { credentialStore, settingsStore } from "@wenyan-md/ui";
import { uploadImageBridge } from "../bridge/upload";
import { publishWechatDraft } from "../bridge/publish";
import type { WechatPublishOptions, WechatUploadResponse } from "@wenyan-md/core/wechat";

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

export async function uploadFileCore(file: Blob | File, fileName: string): Promise<WechatUploadResponse> {
    if (checkUploadEnabed() && checkCredential()) {
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        const resp = await uploadImageBridge("blob", uint8Array, fileName, settingsStore.uploadSettings.autoCache);
        return resp;
    }
    throw new Error("上传条件未满足");
}

export async function publishArticleToDraft(publishOption: WechatPublishOptions): Promise<string> {
    if (checkUploadEnabed() && checkCredential()) {
        return await publishWechatDraft(publishOption);
    }
    throw new Error("发布条件未满足");
}
