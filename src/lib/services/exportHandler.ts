import { domToPng } from "modern-screenshot";
import { globalState } from "@wenyan-md/ui";
import { downloadImageToBase64 } from "$lib/utils";
import { saveImage } from "../bridge/system";

export async function exportImage() {
    const element = document.getElementById("wenyan");
    if (!element) return;

    let bgColor = window.getComputedStyle(document.body).backgroundColor;
    // 如果获取到的是透明色 (rgba(0, 0, 0, 0)) 或者 transparent，设置为白色
    if (bgColor === "rgba(0, 0, 0, 0)" || bgColor === "transparent") {
        bgColor = "#ffffff";
    }

    // 1. 克隆并配置
    const clonedWenyan = element.cloneNode(true) as HTMLElement;
    Object.assign(clonedWenyan.style, {
        position: "fixed",
        top: "0",
        left: "0",
        zIndex: "-9999",
        width: "420px",
        backgroundColor: bgColor,
        pointerEvents: "none",
    });

    try {
        globalState.isLoading = true;
        // 2. 处理图片替换 (等待全部下载完成)
        const images = clonedWenyan.querySelectorAll("img");
        const promises = Array.from(images).map(async (img) => {
            if (!img.src.startsWith("data:")) {
                img.src = await downloadImageToBase64(img.src);
            }
        });
        await Promise.all(promises); // 等待所有图片下载完再往下走

        // 3. 挂载 DOM
        document.body.appendChild(clonedWenyan);

        // 4. 生成图片 (此时 clonedWenyan 确定在 DOM 中)
        const dataUrl = await domToPng(clonedWenyan, {
            scale: 2,
            backgroundColor: bgColor,
            fetch: { requestInit: { mode: "cors" } },
        });

        // 5. 保存逻辑 (使用 bridge)
        const base64Part = dataUrl.split(",")[1];
        const binaryString = atob(base64Part);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        await saveImage(bytes, "wenyan-export.png");
        
    } catch (error) {
        console.error("保存失败:", error);
        globalState.setAlertMessage({
            type: "error",
            message: `保存失败: ${error instanceof Error ? error.message : String(error)}`,
        });
    } finally {
        if (clonedWenyan.parentNode) {
            document.body.removeChild(clonedWenyan);
        }
        globalState.isLoading = false;
    }
}
