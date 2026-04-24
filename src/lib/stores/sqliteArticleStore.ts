import type { ArticleStorageAdapter, Article } from "@wenyan-md/ui";
import * as articleBridge from "../bridge/article";

const OLD_ARTICLE_STORAGE_KEY = "lastArticle";

export const sqliteArticleStorageAdapter: ArticleStorageAdapter = {
    async load(): Promise<Article[]> {
        const articles = await articleBridge.loadArticles();
        if (articles.length > 0) {
            return articles;
        }
        // 兼容旧数据
        const singleArticleData = localStorage.getItem(OLD_ARTICLE_STORAGE_KEY);
        if (singleArticleData) {
            const legacyArticle: Article = {
                id: "1",
                title: "last article",
                content: singleArticleData,
                created: Date.now(),
            };
            const legacyArticles = [legacyArticle];
            await this.save(legacyArticle);
            localStorage.removeItem(OLD_ARTICLE_STORAGE_KEY);
            return legacyArticles;
        }
        return [];
    },
    async save(article: Article): Promise<void> {
        await articleBridge.saveArticle(article);
    },
    async remove(id: string): Promise<void> {
        await articleBridge.removeArticle(id);
    },
};

export async function updateLastArticlePath(
    fileName: string | null,
    filePath: string | null,
    relativePath: string | null,
): Promise<void> {
    await articleBridge.updateLastArticlePath(fileName, filePath, relativePath);
}

export async function getLastArticleRelativePath(): Promise<string | null> {
    return await articleBridge.getLastArticleRelativePath();
}
