import { themeStore, settingsStore, localStorageSettingsAdapter, articleStore, credentialStore } from "@wenyan-md/ui";
import { sqliteThemeStorageAdapter } from "./stores/sqliteThemeStore";
import { sqliteArticleStorageAdapter } from "./stores/sqliteArticleStore";
import { sqliteCredentialStoreAdapter } from "./stores/sqliteCredentialStore";

export async function registerStore() {
    await themeStore.register(sqliteThemeStorageAdapter);
    await settingsStore.register(localStorageSettingsAdapter);
    await articleStore.register(sqliteArticleStorageAdapter);
    await credentialStore.register(sqliteCredentialStoreAdapter);
}
