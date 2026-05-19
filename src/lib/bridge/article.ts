import type { Article } from "@wenyan-md/ui";
import { invokeBridge } from "./invoke";

export async function loadArticles(): Promise<Article[]> {
    return await invokeBridge("load_articles");
}

export async function openMarkdownFile(path: string): Promise<string> {
    return await invokeBridge("open_markdown_file", { path });
}

export async function openProcessedMarkdownFile(
    path: string,
    options: { autoUploadLocal: boolean; autoUploadNetwork: boolean; autoCache: boolean },
): Promise<string> {
    return await invokeBridge("open_markdown_file_processed", { path, options });
}

export async function getDefaultArticle(): Promise<string> {
    return await invokeBridge("get_default_article");
}

export async function saveArticle(article: Article): Promise<void> {
    await invokeBridge("save_article", { title: article.title, content: article.content });
}

export async function removeArticle(id: string): Promise<void> {
    await invokeBridge("remove_article", { id });
}

export async function getLastArticleRelativePath(): Promise<string | null> {
    return await invokeBridge("get_last_article_relative_path");
}

export async function updateLastArticlePath(
    fileName: string | null,
    filePath: string | null,
    relativePath: string | null,
): Promise<void> {
    await invokeBridge("update_last_article_path", { fileName, filePath, relativePath });
}
