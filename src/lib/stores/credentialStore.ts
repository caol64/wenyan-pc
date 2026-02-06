import { DBInstance } from "$lib/db";
import type { CredentialStoreAdapter, CredentialType, GenericCredential } from "@wenyan-md/ui";

interface CredentialDO {
    id: number;
    type: CredentialType;
    name: string;
    appId: string;
    appSecret: string;
    accessToken: string;
    refreshToken: string;
    expireTime: number;
    updatedAt: number;
    createdAt: string;
}

export const sqliteCredentialStoreAdapter: CredentialStoreAdapter = {
    async load(): Promise<GenericCredential[]> {
        const db = await DBInstance.getInstance();
        const rows = await db.select<CredentialDO[]>("SELECT * FROM Credential;");
        return rows.map((row) => ({
            type: row.type,
            name: row.name ?? "",
            appId: row.appId ?? "",
            appSecret: row.appSecret ?? "",
            accessToken: row.accessToken ?? "",
            refreshToken: row.refreshToken ?? "",
            expireTime: row.expireTime ?? 0,
            updatedAt: row.updatedAt ?? 0,
        }));
    },
    async save(credential: GenericCredential): Promise<void> {
        const db = await DBInstance.getInstance();
        const row = await db.select<CredentialDO[]>("SELECT * FROM Credential WHERE type = $1;", [credential.type]);
        if (row.length === 0) {
            await db.execute("INSERT INTO Credential (type, name, appId, appSecret, accessToken, refreshToken, expireTime, updatedAt, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);", [
                credential.type,
                credential.name ?? null,
                credential.appId ?? null,
                credential.appSecret ?? null,
                credential.accessToken ?? null,
                credential.refreshToken ?? null,
                credential.expireTime ?? 0,
                credential.updatedAt ?? 0,
                new Date().toISOString(),
            ]);
        } else {
            await db.execute("UPDATE Credential SET name = $1, appId = $2, appSecret = $3, accessToken = $4, refreshToken = $5, expireTime = $6, updatedAt = $7 WHERE type = $8;", [
                credential.name ?? null,
                credential.appId ?? null,
                credential.appSecret ?? null,
                credential.accessToken ?? null,
                credential.refreshToken ?? null,
                credential.expireTime ?? 0,
                credential.updatedAt ?? 0,
                credential.type,
            ]);
        }
    },
    async remove(type: string): Promise<void> {
        throw new Error("Function not implemented.");
    },
};
