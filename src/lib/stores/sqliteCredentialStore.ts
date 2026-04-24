import type { CredentialStoreAdapter, GenericCredential } from "@wenyan-md/ui";
import * as credentialBridge from "../bridge/credential";

interface oldGzhImageHost {
    type: string;
    appId: string;
    appSecret: string;
    accessToken: string;
    expireTime: number;
    isEnabled: boolean;
}

export const sqliteCredentialStoreAdapter: CredentialStoreAdapter = {
    async load(): Promise<GenericCredential[]> {
        const credentials = await credentialBridge.loadCredentials();
        if (credentials.length > 0) {
            return credentials;
        }
        // 兼容旧数据
        const imageHostsStr = localStorage.getItem("customImageHosts");
        const imageHosts = JSON.parse(imageHostsStr ?? "[]") as oldGzhImageHost[];
        if (imageHosts.length > 0) {
            await this.save({
                type: "wechat",
                name: "wechat",
                appId: imageHosts[0].appId,
                appSecret: imageHosts[0].appSecret,
            });
            await updateWechatAccessToken(imageHosts[0].accessToken, imageHosts[0].expireTime);
            localStorage.removeItem("customImageHosts");
            return [
                {
                    type: "wechat",
                    name: "wechat",
                    appId: imageHosts[0].appId,
                    appSecret: imageHosts[0].appSecret,
                },
            ];
        }
        return [];
    },
    async save(credential: GenericCredential): Promise<void> {
        await credentialBridge.saveCredential(credential);
    },
    async remove(type: string): Promise<void> {
        throw new Error("Function not implemented.");
    },
};

export async function updateWechatAccessToken(accessToken: string, expireTime: number) {
    await credentialBridge.updateWechatToken(accessToken, expireTime);
}

export async function resetWechatAccessToken() {
    await credentialBridge.updateWechatToken(null, 0);
}

export async function getWechatToken() {
    return await credentialBridge.getWechatToken();
}
