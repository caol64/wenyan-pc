import type { ArticleStorageAdapter, Article } from "@wenyan-md/ui";
import { DBInstance } from "./db";

export interface ArticleDO {
    id: number;
    title: string;
    content: string;
    fileName: string | null;
    filePath: string | null;
    relativePath: string | null;
    createdAt: string;
}

const OLD_ARTICLE_STORAGE_KEY = "lastArticle";

export const sqliteArticleStorageAdapter: ArticleStorageAdapter = {
    async load(): Promise<Article[]> {
        const db = await DBInstance.getInstance();
        const articles = await db.select<ArticleDO[]>("SELECT * FROM Article ORDER BY id DESC;");
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
        const row = await db.select<ArticleDO[]>("SELECT * FROM Article ORDER BY id DESC;");
        if (row.length === 0) {
            await db.execute("INSERT INTO Article (title, content, createdAt) VALUES ($1, $2, $3);", [
                article.title,
                article.content,
                new Date().toISOString(),
            ]);
        } else {
            const id = row[0].id;
            await db.execute("UPDATE Article SET title = $1, content = $2, createdAt = $3 WHERE id = $4;", [
                article.title,
                article.content,
                new Date().toISOString(),
                id,
            ]);
        }
    },
    async remove(id: string): Promise<void> {
        const db = await DBInstance.getInstance();
        await db.execute("DELETE FROM Article WHERE id = $1;", [id]);
    },
};

export async function getLastArticle(): Promise<ArticleDO | null> {
    const db = await DBInstance.getInstance();
    const rows = await db.select<ArticleDO[]>("SELECT * FROM Article ORDER BY id DESC LIMIT 1;");
    if (rows.length === 0) {
        return null;
    }
    return rows[0];
}

export async function updateLastArticlePath(
    fileName: string | null,
    filePath: string | null,
    relativePath: string | null,
): Promise<void> {
    const lastArticle = await getLastArticle();
    if (!lastArticle) {
        return;
    }
    const db = await DBInstance.getInstance();
    await db.execute("UPDATE Article SET fileName = $1, filePath = $2, relativePath = $3 WHERE id = $4;", [
        fileName,
        filePath,
        relativePath,
        lastArticle.id,
    ]);
}
