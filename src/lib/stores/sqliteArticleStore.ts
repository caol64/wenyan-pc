import type { ArticleStorageAdapter, Article } from "@wenyan-md/ui";
import { DBInstance } from "../db";

interface ArticleDO {
    id: number;
    title: string;
    content: string;
    createdAt: string;
}

const OLD_ARTICLE_STORAGE_KEY = "lastArticle";

export const sqliteArticleStorageAdapter: ArticleStorageAdapter = {
    async load(): Promise<Article[]> {
        const db = await DBInstance.getInstance();
        const articles = await db.select<ArticleDO[]>("SELECT * FROM Article order by id desc;");
        if (articles.length > 0) {
            return articles.map((row) => ({
                id: String(row.id),
                title: row.title,
                content: row.content,
                created: new Date(row.createdAt).getTime(),
            }));
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
        const db = await DBInstance.getInstance();
        const row = await db.select<ArticleDO[]>("SELECT * FROM Article WHERE id = $1;", [article.id || 1]);
        if (row.length === 0) {
            await db.execute("INSERT INTO Article (title, content, createdAt) VALUES ($1, $2, $3);", [
                article.title,
                article.content,
                new Date().toISOString(),
            ]);
        } else {
            await db.execute("UPDATE Article SET title = $1, content = $2, createdAt = $3 WHERE id = $4;", [
                article.title,
                article.content,
                new Date().toISOString(),
                article.id,
            ]);
        }
    },
    async remove(id: string): Promise<void> {
        const db = await DBInstance.getInstance();
        await db.execute("DELETE FROM Article WHERE id = $1;", [id]);
    },
};
