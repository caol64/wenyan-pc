import { invoke } from "@tauri-apps/api/core";
import type { Article } from "@wenyan-md/ui";

export async function loadArticles(): Promise<Article[]> {
    return await invoke("load_articles");
}

export async function openMarkdownFile(path: string): Promise<string> {
    return await invoke("open_markdown_file", { path });
}

export async function getDefaultArticle(): Promise<string> {
    return await invoke("get_default_article");
}

export async function saveArticle(article: Article): Promise<void> {
    await invoke("save_article", { title: article.title, content: article.content });
}

export async function removeArticle(id: string): Promise<void> {
    await invoke("remove_article", { id });
}

export async function getLastArticleRelativePath(): Promise<string | null> {
    return await invoke("get_last_article_relative_path");
}

export async function updateLastArticlePath(
    fileName: string | null,
    filePath: string | null,
    relativePath: string | null,
): Promise<void> {
    await invoke("update_last_article_path", { fileName, filePath, relativePath });
}
