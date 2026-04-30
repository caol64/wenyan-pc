import { settingsStore } from "@wenyan-md/ui";
import { uploadImageBridge } from "../bridge/upload";
import { publishWechatDraft } from "../bridge/publish";
import type { WechatPublishOptions, WechatUploadResponse } from "@wenyan-md/core/wechat";

export async function uploadFileCore(file: Blob | File, fileName: string): Promise<WechatUploadResponse> {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    return await uploadImageBridge(
        "blob",
        uint8Array,
        fileName,
        settingsStore.uploadSettings.autoCache,
        settingsStore.enabledImageHost === "wechat",
    );
}

export async function publishArticleToDraft(publishOption: WechatPublishOptions): Promise<string> {
    return await publishWechatDraft(publishOption, settingsStore.enabledImageHost === "wechat");
}
