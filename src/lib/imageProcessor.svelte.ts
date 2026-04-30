import type { ImageProcessorAction } from "@wenyan-md/ui";
import { pathToBase64 } from "./bridge/system";

export const imageProcessorAction: ImageProcessorAction = (node) => {
    const run = async () => {
        const images = node.querySelectorAll<HTMLImageElement>("img");
        if (images.length === 0) return;

        for (const img of images) {
            const dataSrc = img.getAttribute("src");

            if (
                !dataSrc ||
                dataSrc.startsWith("data:") ||
                (dataSrc.startsWith("http") && !dataSrc.startsWith("https://mmbiz.qpic.cn"))
            ) {
                continue;
            }

            try {
                const resolvedSrc = await pathToBase64(dataSrc);
                if (resolvedSrc && resolvedSrc.startsWith("data:")) {
                    img.setAttribute("data-src", dataSrc);
                    img.src = resolvedSrc;
                }
            } catch (err) {
                console.error("Image process failed:", dataSrc, err);
            }
        }
    };

    // 首次运行
    run();

    // 如果内容动态变化，可以用 MutationObserver
    const observer = new MutationObserver(() => run());

    observer.observe(node, {
        childList: true,
        subtree: true,
    });

    return {
        destroy() {
            observer.disconnect();
        },
    };
};
