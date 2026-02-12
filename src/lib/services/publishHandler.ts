import { getWenyanElement } from "$lib/utils";
import type { WechatUploadResponse } from "@wenyan-md/core/wechat";
import { publishArticleToDraft } from "./wechatHandler";
import { globalState, wenyanRenderer, wenyanCopier } from "@wenyan-md/ui";
import { open } from "@tauri-apps/plugin-shell";
import {
    uploadBase64ImageWithCache,
    uploadLocalImageWithCache,
    uploadNetworkImageWithCache,
} from "./imageUploadService";

export interface ArticleOptions {
    title: string;
    content: string;
    cover?: string;
    author?: string;
    source_url?: string;
}

export async function publishHandler() {
    try {
        globalState.isLoading = true;
        const { title, cover, author, source_url } = wenyanRenderer.frontMatterResult;
        if (!title) throw new Error("未能找到文章标题");

        const wenyanElement = getWenyanElement();
        // 处理文档中的图片资源，上传到微信服务器并替换为微信服务器的URL，返回第一张图片的media_id作为封面备用
        const firstImageId = await uploadImages(wenyanElement);
        let coverImageId = "";
        // 处理frontmatter中的cover字段，如果存在，则上传并替换为media_id
        if (cover) {
            const uploadResult = await uploadImage(cover);
            coverImageId = uploadResult.media_id;
        } else {
            // 如果frontmatter中没有cover字段但文章内容中有图片，则使用第一张图片作为封面
            if (firstImageId.startsWith("https://mmbiz.qpic.cn")) {
                // 如果是url，需要将其转换为media_id
                const uploadResult = await uploadImage(firstImageId);
                coverImageId = uploadResult.media_id;
            } else {
                // 如果已经是media_id了，直接使用
                coverImageId = firstImageId;
            }
        }
        if (!coverImageId) {
            throw new Error("未能找到文章封面");
        }
        await wenyanCopier.copy(wenyanElement);
        const content = wenyanCopier.html;
        await publishArticleToDraft({
            title,
            content,
            thumb_media_id: coverImageId,
            author,
            content_source_url: source_url,
        });
        globalState.setAlertMessage({
            type: "info",
            message: "文章已成功发布到微信草稿箱，请前往微信公众平台查看并发布。",
        });
    } catch (error) {
        globalState.setConfirmMessage({
            message: error instanceof Error ? error.message : String(error),
            action: async () => {await open("https://yuzhi.tech/docs/wenyan/publish")},
            actionLabel: "查看教程",
        });
    } finally {
        globalState.isLoading = false;
    }
}

async function uploadImages(wenyanElement: HTMLElement): Promise<string> {
    const images = Array.from(wenyanElement.querySelectorAll("img"));
    const uploadPromises = images.map(async (element) => {
        const dataSrc = element.getAttribute("src");
        if (dataSrc) {
            if (!dataSrc.startsWith("https://mmbiz.qpic.cn")) {
                const resp = await uploadImage(dataSrc);
                element.setAttribute("src", resp.url);
                return resp.media_id;
            } else {
                return dataSrc;
            }
        }
        return null;
    });
    const mediaIds = (await Promise.all(uploadPromises)).filter(Boolean);
    const firstImageId = mediaIds[0] || "";
    return firstImageId;
}

async function uploadImage(imageUrl: string): Promise<WechatUploadResponse> {
    if (imageUrl.startsWith("http")) {
        return await uploadNetworkImageWithCache(imageUrl);
    } else if (imageUrl.startsWith("data:")) {
        return await uploadBase64ImageWithCache(imageUrl);
    } else {
        return await uploadLocalImageWithCache(imageUrl);
    }
}
