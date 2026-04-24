# 文颜桌面端架构整改计划

## 1. 整改目标

把当前“前端直接操作 Tauri 宿主能力”的结构，重构为：

- `src/` 只负责 UI、交互和桥接调用
- `src-tauri/` 负责业务服务、数据持久化、文件系统、网络访问和平台集成
- 所有前后端通信通过统一 bridge 层完成

## 2. 整改原则

- [ ] 前端业务代码中不再直接使用 `@tauri-apps/plugin-sql`
- [ ] 前端业务代码中不再直接使用 `@tauri-apps/plugin-fs`
- [ ] 前端业务代码中不再直接使用 `@tauri-apps/plugin-http`
- [ ] 前端业务代码中不再直接使用 `@tauri-apps/api/path`
- [ ] 前端业务代码中不再散落 `invoke` / `listen`
- [ ] 所有跨端调用都有明确 DTO 与错误模型
- [ ] Rust 侧按“命令层 / 应用服务层 / 基础设施层”拆分
- [ ] capability 从“前端直接拿权限”收敛为“仅允许必要 command”

## 3. 优先级建议

### P0：先切断业务层对 Tauri 插件的直连

优先迁移最典型的后端职责：

1. SQLite
2. Markdown 文件打开与路径上下文
3. 图片上传与上传缓存
4. 微信 token 与发布
5. 导出保存

### P1：建立桥接层和统一错误模型

在前端形成稳定的 `bridge/` 目录，收敛所有 `invoke/listen`。

### P2：进一步收敛宿主 UI 能力

对窗口控制、版本信息、外链打开等壳层能力做统一封装，避免继续向业务层渗透。

## 4. 分阶段实施计划

## 阶段 1：建立目标骨架

### 目标

先把“未来放业务的位置”搭起来，避免继续把新逻辑写回前端。

### 需要修改

- `src-tauri/src/`：新增分层目录
- `src/lib/`：新增 bridge 目录
- `src-tauri/src/main.rs`：只负责组装命令、插件与启动

### Checklist

- [ ] 在 `src-tauri/src/` 下建立 `commands/`
- [ ] 在 `src-tauri/src/` 下建立 `application/`
- [ ] 在 `src-tauri/src/` 下建立 `domain/`
- [ ] 在 `src-tauri/src/` 下建立 `infrastructure/`
- [ ] 在 `src-tauri/src/` 下建立 `dto/`
- [ ] 在 `src-tauri/src/` 下建立统一 `error.rs`
- [ ] 在 `src/lib/` 下建立 `bridge/`
- [ ] 约定：只有 `bridge/` 可以直接 `invoke/listen`
- [ ] 约定：页面、stores、services 禁止再直接引入 Tauri 宿主插件

## 阶段 2：迁移数据层（SQLite）

### 当前涉及文件

- `src/lib/stores/db.ts`
- `src/lib/stores/sqliteThemeStore.ts`
- `src/lib/stores/sqliteArticleStore.ts`
- `src/lib/stores/sqliteCredentialStore.ts`
- `src/lib/stores/sqliteUploadCacheStore.ts`

### 目标

把前端直接操作 SQLite 改成 Rust repository + command。

### Checklist

- [ ] Rust 侧建立数据库初始化与迁移入口
- [ ] Rust 侧定义 Theme / Article / Credential / UploadCache 的 repository
- [ ] Rust 侧承接建表逻辑，不再由前端建表
- [ ] Rust 侧承接旧数据迁移策略
- [ ] 前端 store adapter 改为 bridge 调用，不再写 SQL
- [ ] `DBInstance` 从前端移除
- [ ] 统一 DTO：`ThemeDto`、`ArticleDto`、`CredentialDto`、`UploadCacheDto`
- [ ] 明确持久化接口是 CRUD 还是 query service，避免命令粒度过碎

## 阶段 3：迁移文章打开与文件系统上下文

### 当前涉及文件

- `src/lib/services/fileOpenHandler.ts`
- `src/lib/services/markdownContentHandler.ts`
- `src/lib/tauriFsAdapter.ts`
- `src/lib/utils.ts` 中的路径处理与资源读取逻辑

### 目标

让“打开文章、读取 Markdown、获取资源、维护最近文章上下文、目录浏览”都由 Rust 侧负责。

### Checklist

- [ ] Rust 侧提供 `open_markdown_file`
- [ ] Rust 侧提供 `get_default_article`
- [ ] Rust 侧提供 `read_directory_entries`
- [ ] Rust 侧提供路径解析能力：绝对路径、相对路径、目录名、文件名
- [ ] Rust 侧维护最近文章的文件路径与相对路径上下文
- [ ] 前端 `fileOpenHandler.ts` 改为仅接收 bridge 返回结果
- [ ] 前端 `tauriFsAdapter.ts` 改为 `bridgeFsAdapter`
- [ ] 前端不再直接读取文件或拼接业务路径
- [ ] `open-file` 事件改为集中封装在桥接层

## 阶段 4：迁移图片上传与上传缓存

### 当前涉及文件

- `src/lib/services/imageUploadService.ts`
- `src/lib/imageProcessor.svelte.ts`
- `src/lib/utils.ts` 中的 MD5、文件读取、网络下载相关逻辑
- `src/lib/stores/sqliteUploadCacheStore.ts`

### 目标

把“图片来源识别 -> 路径解析 -> 文件读取/下载 -> MD5 -> 缓存命中 -> 上传 -> 回写缓存”整体迁移到 Rust。

### Checklist

- [ ] Rust 侧定义图片来源类型：本地路径 / 网络 URL / Base64 / Blob
- [ ] Rust 侧实现统一图片上传服务
- [ ] Rust 侧实现 MD5 计算服务并纳入上传流程
- [ ] Rust 侧实现上传缓存读取与写入
- [ ] Rust 侧负责网络图片下载
- [ ] Rust 侧负责本地图片读取与 MIME 推断
- [ ] 前端 `uploadImage` / `uploadBlobImageWithCache` 改为 bridge 调用
- [ ] 前端不再直接读文件、不再直接抓网络图片、不再直接查缓存表
- [ ] 明确失败策略：单图失败时是跳过、终止还是返回部分结果
- [ ] 将当前“console.error + 部分成功”的行为改成可配置、可回传的结构化结果

## 阶段 5：迁移微信发布与凭据管理

### 当前涉及文件

- `src/lib/services/wechatHandler.ts`
- `src/lib/stores/sqliteCredentialStore.ts`
- `src/lib/setHooks.ts` 中发布相关 hook

### 目标

让微信接入、token 生命周期、素材上传、草稿发布都由 Rust 负责。

### Checklist

- [ ] Rust 侧建立 WeChat client 适配层
- [ ] Rust 侧管理 access token 获取、缓存、过期判断与刷新
- [ ] Rust 侧管理 credential 持久化
- [ ] Rust 侧暴露 `upload_wechat_material`
- [ ] Rust 侧暴露 `publish_wechat_draft`
- [ ] Rust 侧暴露 `reset_wechat_token`
- [ ] 前端发布按钮改为调用 bridge，不再直接持有平台交互细节
- [ ] 错误模型区分：凭据缺失、token 过期、上传失败、发布失败

## 阶段 6：迁移导出与本地保存

### 当前涉及文件

- `src/lib/services/exportHandler.ts`
- `src/lib/utils.ts` 中的下载/资源处理逻辑

### 目标

前端只负责生成导出所需的 DOM 或中间数据；保存路径选择、文件写入由 Rust 承担。

### Checklist

- [ ] 明确导出边界：DOM 转 PNG 留在前端还是迁移到 Rust
- [ ] 若保留前端截图：保存对话框和写文件迁移到 Rust
- [ ] bridge 提供 `save_exported_image`
- [ ] 统一处理导出取消、写入失败、权限错误
- [ ] 前端 `exportHandler.ts` 去除直接 `dialog` / `fs.writeFile`

## 阶段 7：收敛桥接层并清理前端直连

### 目标

把所有跨端调用收拢到单一入口，形成清晰 API 面。

### Checklist

- [ ] 建立 `src/lib/bridge/article.ts`
- [ ] 建立 `src/lib/bridge/theme.ts`
- [ ] 建立 `src/lib/bridge/credential.ts`
- [ ] 建立 `src/lib/bridge/upload.ts`
- [ ] 建立 `src/lib/bridge/publish.ts`
- [ ] 建立 `src/lib/bridge/system.ts`
- [ ] 建立统一 `src/lib/bridge/events.ts`
- [ ] 页面与 service 只依赖 bridge，不依赖 Tauri 插件
- [ ] 搜索并清理 `src/` 中分散的 `invoke/listen`

## 阶段 8：权限与配置收口

### 当前涉及文件

- `src-tauri/capabilities/migrated.json`
- `src-tauri/src/main.rs`
- `src-tauri/Cargo.toml`
- 根目录 `package.json`

### 目标

在业务迁移完成后，收紧 capability 和前端依赖面。

### Checklist

- [ ] 删除前端不再需要的 Tauri 插件直接使用面
- [ ] 收紧 capability，避免继续向 WebView 暴露通用 `fs/sql/http`
- [ ] 仅保留必要 command 权限
- [ ] 清理不再需要的前端 Tauri 依赖
- [ ] 评估仍需保留的 UI 壳层能力（窗口、版本、外链）

## 5. 建议的桥接接口清单

以下是建议优先提供的 bridge API：

- [ ] `articleBridge.getDefaultArticle()`
- [ ] `articleBridge.openMarkdownFile(path)`
- [ ] `articleBridge.getLastArticleContext()`
- [ ] `themeBridge.loadThemes()`
- [ ] `themeBridge.saveTheme(payload)`
- [ ] `credentialBridge.loadCredentials()`
- [ ] `credentialBridge.saveCredential(payload)`
- [ ] `credentialBridge.resetWechatToken()`
- [ ] `uploadBridge.uploadImage(payload)`
- [ ] `publishBridge.publishWechatDraft(payload)`
- [ ] `systemBridge.readDirectory(path)`
- [ ] `systemBridge.saveExportedImage(payload)`
- [ ] `eventsBridge.onOpenFile(handler)`

## 6. 逐文件整改清单

### 前端

- [ ] `src/lib/stores/db.ts`：删除前端数据库连接与建表职责
- [ ] `src/lib/stores/sqliteThemeStore.ts`：改为 bridge adapter
- [ ] `src/lib/stores/sqliteArticleStore.ts`：改为 bridge adapter
- [ ] `src/lib/stores/sqliteCredentialStore.ts`：改为 bridge adapter
- [ ] `src/lib/stores/sqliteUploadCacheStore.ts`：迁移到 Rust repository
- [ ] `src/lib/services/fileOpenHandler.ts`：只保留 UI 触发和结果展示
- [ ] `src/lib/services/markdownContentHandler.ts`：移除底层文件读取职责
- [ ] `src/lib/services/imageUploadService.ts`：迁移为 bridge 调用壳
- [ ] `src/lib/services/wechatHandler.ts`：迁移为 bridge 调用壳
- [ ] `src/lib/services/exportHandler.ts`：移除本地保存细节
- [ ] `src/lib/tauriFsAdapter.ts`：替换为 `bridgeFsAdapter`
- [ ] `src/lib/utils.ts`：拆分出纯前端工具与跨端桥接调用，删除宿主业务工具集合
- [ ] `src/lib/setHooks.ts`：改成只绑定 UI hook，不承载宿主业务实现
- [ ] `src/routes/+page.svelte`：避免直接依赖宿主实现对象

### Rust

- [ ] `src-tauri/src/main.rs`：瘦身为模块注册与应用启动入口
- [ ] `src-tauri/src/commands/*`：承接 command 入口
- [ ] `src-tauri/src/application/*`：承接业务编排
- [ ] `src-tauri/src/infrastructure/db/*`：承接 SQLite
- [ ] `src-tauri/src/infrastructure/fs/*`：承接文件系统和路径
- [ ] `src-tauri/src/infrastructure/http/*`：承接平台 HTTP 调用
- [ ] `src-tauri/src/events/*`：集中处理系统事件转发
- [ ] `src-tauri/src/error.rs`：统一错误返回结构

## 7. 完成标志

以下条件同时满足，才算整改基本完成：

- [ ] `src/` 业务代码中不再直接出现 `plugin-sql`
- [ ] `src/` 业务代码中不再直接出现 `plugin-fs`
- [ ] `src/` 业务代码中不再直接出现 `plugin-http`
- [ ] `src/` 业务代码中不再直接出现散落的路径处理宿主逻辑
- [ ] 前端页面与 services 只通过 `bridge/` 调用后端
- [ ] Rust 侧具备清晰的 command / service / repository 分层
- [ ] capability 已按新边界收紧
- [ ] 核心流程可跑通：打开文章、处理图片、上传、发布、导出、持久化

## 8. 风险与注意事项

- [ ] 不要一次性大爆炸式迁移全部模块，优先切掉最重的业务链路
- [ ] 迁移过程中保持 bridge 接口稳定，避免 UI 层频繁返工
- [ ] 先定义 DTO，再迁移实现，避免前后端协议反复变动
- [ ] 旧数据兼容逻辑必须保留到 Rust 侧接管完成
- [ ] 不要把“窗口按钮、关于页、外链打开”与核心业务迁移混为同一优先级

## 9. 推荐落地顺序

1. 先搭 Rust 分层骨架和前端 bridge 目录。
2. 再迁移 SQLite 与文章打开链路。
3. 再迁移图片上传与微信发布链路。
4. 最后收口导出、壳层能力和 capability。
