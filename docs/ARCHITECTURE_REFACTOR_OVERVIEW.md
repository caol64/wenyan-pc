# 文颜桌面端架构整改说明

## 1. 项目现状

当前项目是一个基于 **SvelteKit + Tauri v2 + Rust** 的桌面应用：

- `src/`：前端界面、状态、业务逻辑、宿主能力调用
- `src-tauri/`：Tauri 桌面壳、插件注册、少量 Rust 命令
- `wenyan-ui/`：共享 UI 能力
- `@wenyan-md/core`：Markdown 渲染、平台发布核心逻辑

从目录上看，项目似乎已经具备“前端 + Rust 后端”的形态；但从实际职责分布看，**大部分桌面端业务仍然写在前端**，Rust 侧并未成为真正的业务后端。

### 1.1 当前职责分布

#### 前端 `src/` 实际承担的职责

前端目前不只是 UI 层，而是直接调用 Tauri 接口承担了大量宿主能力和业务编排：

| 模块 | 当前文件 | 现状 |
| --- | --- | --- |
| SQLite 初始化与建表 | `src/lib/stores/db.ts` | 前端直接通过 `@tauri-apps/plugin-sql` 建表并持有数据库连接 |
| 主题/文章/凭据/上传缓存存储 | `src/lib/stores/sqliteThemeStore.ts` `sqliteArticleStore.ts` `sqliteCredentialStore.ts` `sqliteUploadCacheStore.ts` | 前端直接写 SQL、做数据迁移、维护持久化结构 |
| 文件读取与 Markdown 打开 | `src/lib/services/markdownContentHandler.ts` `fileOpenHandler.ts` | 前端直接读文件、解析路径、处理系统打开文件事件 |
| 文件系统浏览 | `src/lib/tauriFsAdapter.ts` | 前端直接打开目录选择器、读目录、拼接路径 |
| 路径与资源解析 | `src/lib/utils.ts` | 前端直接做资源路径、绝对路径、文件名、目录等宿主路径操作 |
| 图片上传与缓存 | `src/lib/services/imageUploadService.ts` | 前端直接读本地文件、下载网络图片、计算 MD5、命中 SQLite 缓存并上传 |
| 微信发布与 token 管理 | `src/lib/services/wechatHandler.ts` | 前端直接发 HTTP 请求、刷新 token、更新数据库 |
| 导出图片保存 | `src/lib/services/exportHandler.ts` | 前端直接弹保存框、写文件 |
| 剪贴板写入 | `src/lib/utils.ts` `copyHandler.ts` | 前端直接写 HTML/文本到系统剪贴板 |
| Shell 打开外链 | `src/lib/setHooks.ts` `AboutPage.svelte` | 前端直接调系统 Shell |
| 宿主事件监听 | `src/lib/services/fileOpenHandler.ts` | 前端直接监听 `open-file` 事件 |

#### Rust `src-tauri/` 当前承担的职责

Rust 侧目前主要集中在 `src-tauri/src/main.rs`：

- 注册 Tauri 插件
- 处理单实例启动
- 透传 `open-file` 事件
- 提供两个命令：
  - `get_data_md5`
  - `get_file_md5`

换句话说，Rust 目前更像 **Tauri 启动入口**，而不是桌面应用的业务后端。

## 2. 为什么必须整改

### 2.1 前后端职责不清

当前前端代码既负责：

1. 页面渲染与交互；
2. 业务流程编排；
3. 数据持久化；
4. 文件系统访问；
5. HTTP 调用与 token 生命周期；
6. 与操作系统能力交互。

这使得“前端”已经不是单纯的视图层，而是一个直接拿着宿主权限做业务的超级层。

### 2.2 业务逻辑与 Tauri API 强耦合

例如：

- 图片上传流程依赖前端直接读文件、算 MD5、访问数据库、发 HTTP
- 文章打开流程依赖前端直接读文件并维护最近文章路径
- 微信 token 管理依赖前端直接读写凭据库
- 主题、文章、凭据、缓存等持久化实现全部绑定 `plugin-sql`

这意味着业务逻辑无法脱离 Tauri 前端环境独立演化，也难以做清晰的模块分层和测试。

### 2.3 安全边界和权限边界过宽

当前 `src-tauri/capabilities/migrated.json` 给予前端非常宽的能力面：

- 任意文件读写
- 任意目录读取
- 任意 HTTP 访问
- SQL 执行
- Shell 打开
- 剪贴板写入

当这些能力直接暴露给前端业务代码时，权限的最小化原则很难落地。整改后，应该让前端只拥有“调用受控命令”的能力，而不是直接持有底层系统接口。

### 2.4 演进成本高

当前任何一个桌面能力改动，通常都需要开发者同时理解：

- UI 组件状态
- 前端业务流程
- Tauri 插件 API 细节
- 本地数据结构
- 平台 API 交互

这会让后续继续扩展平台发布能力、替换存储方案、增加离线任务、增加日志诊断都变得更困难。

## 3. 这次整改要解决什么

本次整改的核心目标不是“把所有 Tauri 调用都机械搬到 Rust”，而是明确分层：

### 3.1 前端只保留三类职责

前端 `src/` 应只负责：

1. **视图渲染**：Svelte 页面、组件、状态联动；
2. **交互收集**：表单输入、按钮点击、拖拽/粘贴事件；
3. **桥接调用**：通过统一桥接层调用后端命令并处理返回结果。

### 3.2 Rust 明确承担业务后端职责

Rust `src-tauri/` 应负责：

1. **应用服务层**：文章打开、主题管理、导出、发布、图片上传、缓存命中、凭据更新等业务流程；
2. **基础设施层**：SQLite、文件系统、HTTP、路径、资源读取、日志；
3. **命令入口层**：暴露受控的 Tauri commands / events；
4. **事件分发层**：如系统打开文件、后台任务进度、错误回传。

### 3.3 Tauri API 使用方式改变

整改后，业务代码不应再在前端直接这样做：

- `plugin-sql` 写 SQL
- `plugin-fs` 读写文件
- `plugin-http` 直接请求平台接口
- `plugin-dialog` 直接用于业务保存/选择逻辑
- `api/path` 直接处理业务路径
- `api/core.invoke` 在各处零散调用

而应改成：

- 前端只调用 `src/lib/bridge/*`
- `bridge` 内部只负责参数/返回值的类型定义和统一命令封装
- 具体业务由 Rust 模块实现

## 4. 整改后的目标架构

## 4.1 分层模型

```text
Svelte View / UI State
        |
        v
Frontend Bridge (typed commands/events)
        |
        v
Tauri Command Layer (src-tauri)
        |
        v
Application Services
        |
        +--> Domain Logic
        +--> Repositories
        +--> Host Integrations (fs/sql/http/shell/dialog/clipboard)
```

## 4.2 推荐目录职责

### 前端 `src/`

推荐收敛为：

```text
src/
  lib/
    bridge/          # 前端唯一允许直接接触 Tauri invoke/listen 的地方
    presenters/      # 将后端 DTO 转成 UI 可用数据
    view-models/     # 页面状态与交互编排
    components/      # 纯 UI 组件
    hooks/           # UI 事件绑定，但不包含宿主业务
```

前端应避免再出现：

- 直接 SQL
- 直接文件读写
- 直接平台 HTTP
- 直接 token 持久化
- 直接缓存命中逻辑

### Rust `src-tauri/src/`

推荐逐步拆分为：

```text
src-tauri/src/
  main.rs
  commands/
    article.rs
    theme.rs
    credential.rs
    upload.rs
    publish.rs
    export.rs
    system.rs
  application/
    article_service.rs
    theme_service.rs
    publish_service.rs
    export_service.rs
  domain/
    article.rs
    credential.rs
    theme.rs
    upload_cache.rs
  infrastructure/
    db/
    fs/
    http/
    clipboard/
    shell/
    paths/
  events/
    file_open.rs
  dto/
    requests.rs
    responses.rs
  error.rs
```

这个拆分不要求一次完成，但最终必须让 Rust 侧具备“真正承接业务”的结构。

## 4.3 建议的桥接方式

前端建立统一桥接层，例如：

```ts
// src/lib/bridge/article.ts
export async function openMarkdownFile(path: string): Promise<OpenArticleResult> { ... }
export async function getLastArticleContext(): Promise<ArticleContext> { ... }
```

```rust
// src-tauri/src/commands/article.rs
#[tauri::command]
async fn open_markdown_file(path: String) -> Result<OpenArticleResult, AppError> { ... }
```

要求：

- 前端页面和 service 不再直接接触 Tauri 插件
- 所有 command 都有稳定 DTO
- 错误要统一建模，而不是散落 `string`
- 事件名要集中管理，避免魔法字符串散落

## 5. 哪些逻辑应该迁移到 Rust

### 必须迁移

这些属于明确的后端业务或基础设施职责：

1. SQLite 初始化、建表、查询、更新
2. 文章打开、最近文章路径维护、历史数据迁移
3. 文件读取、目录遍历、路径解析
4. 图片上传、MD5 计算、缓存命中
5. 微信 token 获取、刷新、保存、重置
6. 微信素材上传与草稿发布
7. 导出图片保存流程中的文件写入与保存路径确认
8. 资源文件读取（如 `example.md`）

### 可保留在前端或后续统一抽象

这些更接近 UI 壳层能力，可按优先级处理：

1. 标题栏窗口按钮（最小化、最大化、关闭）
2. 关于页展示版本号/平台信息
3. 打开外部链接

即便这些暂时不迁移，也应满足一个原则：**它们不是业务层依赖，不能再与业务逻辑混在一起。**

## 6. 结合当前代码的典型问题示例

### 6.1 `db.ts` + `sqlite*Store.ts`

问题：

- 前端决定表结构
- 前端直接执行 SQL
- 前端承接数据迁移逻辑

后果：

- 存储结构演进无法由后端统一治理
- repository 层不存在
- 无法形成稳定的数据访问边界

### 6.2 `imageUploadService.ts`

问题：

- 前端读取本地文件
- 前端下载网络图片
- 前端做 MD5
- 前端读缓存表
- 前端发上传请求

这是最典型的“前端拿着系统能力做后端业务”的区域，必须优先迁移。

### 6.3 `wechatHandler.ts`

问题：

- 前端直接与微信接口交互
- 前端刷新 access token
- 前端更新 credential 表

这会让平台接入逻辑、凭据管理和 UI 强耦合。

### 6.4 `markdownContentHandler.ts` / `fileOpenHandler.ts`

问题：

- 前端直接读取 Markdown 文件
- 前端维护最近文章上下文
- 前端监听系统打开文件后直接执行业务处理

整改后，前端拿到的应该是“已处理好的文章加载结果”，而不是亲自做底层文件流程。

## 7. 整改完成后的效果

整改完成后，项目将从“前端直连宿主能力”转为“前端通过桥接层调用 Rust 后端”。

### 7.1 前端开发体验

前端开发者只需要关心：

- 用户做了什么操作
- 需要调用哪个 bridge
- 返回结果如何更新 UI

而不需要在页面逻辑中理解：

- SQL 表结构
- 文件系统细节
- 路径差异
- token 刷新策略
- 图片上传缓存策略

### 7.2 后端治理能力

Rust 侧可以逐步建立：

- 稳定的 repository
- 清晰的应用服务
- 统一错误模型
- 更细粒度的 capability 控制
- 更可观测的日志与诊断能力

### 7.3 权限更可控

最终前端不应再普遍拥有 `fs/sql/http/shell` 等直接使用权，而是通过有限命令暴露最小必要能力。

## 8. 一句话总结

当前项目的问题不是“用了 Tauri”，而是 **把本应属于后端的桌面业务逻辑写进了前端**。整改的目标是让：

- **Rust 成为真正的业务后端**
- **Svelte 回到视图与交互层**
- **前后端之间只通过明确、收敛、可类型化的桥接层通信**
