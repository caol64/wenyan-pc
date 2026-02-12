import type { ImageProcessorAction } from "@wenyan-md/ui";
import { downloadImageToBase64, localPathToBase64 } from "./imageProxy";
import { FIFOCache, getPathType } from "$lib/utils";
import { getLastArticle } from "$lib/stores/sqliteArticleStore";
import { resolveArticleRelativePath } from "./imageUploadService";

const cache = new FIFOCache<string, string>();

export const imageProcessorAction: ImageProcessorAction = (node) => {
    const run = async () => {
        const images = node.querySelectorAll<HTMLImageElement>("img");
        if (images.length === 0) return;
        const lastArticle = await getLastArticle();

        for (const img of images) {
            const dataSrc = img.getAttribute("src");

            if (dataSrc) {
                const resolvedSrc = await resolveArticleRelativePath(dataSrc, lastArticle);
                const cached = cache.get(resolvedSrc);
                if (cached) {
                    img.src = cached;
                    continue;
                }
                try {
                    if (dataSrc.startsWith("https://mmbiz.qpic.cn")) {
                        img.setAttribute("data-src", dataSrc);
                        const base64 = await downloadImageToBase64(dataSrc);
                        if (base64) {
                            cache.set(dataSrc, base64);
                            img.src = base64;
                        }
                    } else if ((await getPathType(dataSrc)) !== "network") {
                        img.setAttribute("data-src", dataSrc);
                        const base64 = await localPathToBase64(resolvedSrc);
                        if (base64) {
                            cache.set(resolvedSrc, base64);
                            img.src = base64;
                        }
                    }
                } catch (err) {
                    console.error("Image process failed:", dataSrc, err);
                }
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
            cache.clear();
        },
    };
};
