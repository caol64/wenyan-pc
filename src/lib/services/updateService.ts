import { globalState } from "@wenyan-md/ui";
import { osType } from "$lib/bridge/system";
import { checkForAppUpdate, installAppUpdate, isTauriRuntime, isUpdaterEnabled, type UpdateInfo } from "$lib/bridge/update";

let activeCheck: Promise<void> | null = null;

export async function checkForUpdates(options: { silent?: boolean } = {}): Promise<void> {
    if (activeCheck) {
        return await activeCheck;
    }

    const task = runUpdateCheck(options);
    activeCheck = task;

    try {
        await task;
    } finally {
        activeCheck = null;
    }
}

async function runUpdateCheck({ silent = false }: { silent?: boolean }): Promise<void> {
    if (!isTauriRuntime()) {
        return;
    }

    if ((await osType()) !== "windows") {
        if (!silent) {
            globalState.setAlertMessage({
                type: "info",
                title: "检查更新",
                message: "自动更新当前仅支持 Windows 桌面端。",
            });
        }
        return;
    }

    if (!(await isUpdaterEnabled())) {
        if (!silent) {
            globalState.setAlertMessage({
                type: "warning",
                title: "检查更新",
                message: "当前构建未配置自动更新服务，请联系维护者补充 updater 配置。",
            });
        }
        return;
    }

    try {
        const update = await checkForAppUpdate();
        if (!update) {
            if (!silent) {
                globalState.setAlertMessage({
                    type: "success",
                    title: "检查更新",
                    message: "当前已经是最新版本。",
                });
            }
            return;
        }

        globalState.setConfirmMessage({
            title: "发现新版本",
            message: buildUpdateMessage(update),
            actionLabel: "下载并安装",
            action: () => {
                void installUpdate();
            },
        });
    } catch (error) {
        if (silent) {
            console.error("Failed to check for updates:", error);
            return;
        }

        globalState.setAlertMessage({
            type: "error",
            title: "检查更新失败",
            message: formatError(error),
        });
    }
}

async function installUpdate(): Promise<void> {
    globalState.isLoading = true;

    try {
        await installAppUpdate();
    } catch (error) {
        globalState.isLoading = false;
        globalState.setAlertMessage({
            type: "error",
            title: "安装更新失败",
            message: formatError(error),
        });
    }
}

function buildUpdateMessage(update: UpdateInfo): string {
    const lines = [
        `当前版本：${escapeHtml(update.currentVersion)}`,
        `最新版本：${escapeHtml(update.version)}`,
    ];

    if (update.body?.trim()) {
        lines.push("", "更新说明：", escapeHtml(update.body).replaceAll("\n", "<br/>"));
    }

    lines.push("", "安装更新时应用会关闭，并启动安装程序。");

    return lines.join("<br/>");
}

function formatError(error: unknown): string {
    if (typeof error === "object" && error !== null && "message" in error) {
        return String((error as { message: unknown }).message);
    }

    return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
