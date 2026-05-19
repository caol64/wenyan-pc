import type { WechatPublishOptions } from "@wenyan-md/core/wechat";
import { invokeBridge } from "./invoke";

export async function publishWechatDraft(options: WechatPublishOptions, wechatEnabled: boolean): Promise<string> {
    return await invokeBridge("publish_wechat_draft", { options, wechatEnabled });
}
