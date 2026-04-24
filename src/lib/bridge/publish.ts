import { invoke } from "@tauri-apps/api/core";
import type { WechatPublishOptions } from "@wenyan-md/core/wechat";

export async function publishWechatDraft(options: WechatPublishOptions): Promise<string> {
    return await invoke("publish_wechat_draft", { options });
}
