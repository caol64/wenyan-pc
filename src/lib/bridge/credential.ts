import type { GenericCredential } from "@wenyan-md/ui";
import { invokeBridge } from "./invoke";

export async function loadCredentials(): Promise<GenericCredential[]> {
    return await invokeBridge("load_credentials");
}

export async function saveCredential(credential: GenericCredential): Promise<void> {
    await invokeBridge("save_credential", {
        type: credential.type,
        name: credential.name,
        appId: credential.appId,
        appSecret: credential.appSecret,
    });
}

export async function updateWechatToken(accessToken: string | null, expireTime: number): Promise<void> {
    await invokeBridge("update_wechat_token", { accessToken, expireTime });
}

export async function getWechatToken(): Promise<any> {
    return await invokeBridge("get_wechat_token");
}
