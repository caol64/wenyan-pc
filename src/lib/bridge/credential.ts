import { invoke } from "@tauri-apps/api/core";
import type { GenericCredential } from "@wenyan-md/ui";

export async function loadCredentials(): Promise<GenericCredential[]> {
    return await invoke("load_credentials");
}

export async function saveCredential(credential: GenericCredential): Promise<void> {
    await invoke("save_credential", {
        type: credential.type,
        name: credential.name,
        appId: credential.appId,
        appSecret: credential.appSecret,
    });
}

export async function updateWechatToken(accessToken: string | null, expireTime: number): Promise<void> {
    await invoke("update_wechat_token", { accessToken, expireTime });
}

export async function getWechatToken(): Promise<any> {
    return await invoke("get_wechat_token");
}
