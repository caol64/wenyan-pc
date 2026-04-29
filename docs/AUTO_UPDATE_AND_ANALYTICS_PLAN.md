# 文颜桌面端自动升级与用户统计方案

## 现状结论

- 项目当前是 **SvelteKit + Tauri v2** 桌面应用，前端入口在 `src/routes/+page.svelte`，宿主能力通过 `src/lib/bridge/*` 接到 Tauri。
- 当前发布链路是 **GitHub Release -> GitHub Actions -> Cloudflare R2**，但 `release.yml` 只在 `windows-latest` 构建并上传 NSIS 安装包。
- 仓库里还没有 updater、analytics、telemetry 的现成实现。
- 因为当前 CI 只稳定产出 Windows 安装包，所以建议按 **Windows-first** 落地自动升级；macOS / Linux 作为第二阶段补齐。

---

## 1. 自动升级方案

## 推荐方案

使用 **Tauri v2 Updater 插件**，配合当前已有的 **R2 静态分发**。

这是最贴合当前项目的方案，因为：

- 现有项目本身就是 Tauri v2；
- 当前已经有 Release 构建和 R2 上传流程；
- Tauri Updater 原生支持 **静态 JSON manifest**；
- 升级包可直接复用现有打包产物，只需补充签名和 `latest.json`。

## 整体架构

```text
App 启动
  -> 前端调用 update bridge
  -> Tauri updater 检查远端 latest.json
  -> 发现新版本后展示更新提示
  -> 下载并安装
  -> 用户确认后重启应用

GitHub Release
  -> Actions 构建 NSIS 安装包
  -> 使用 Tauri signing key 生成 .sig
  -> 生成 latest.json
  -> 上传 exe / sig / latest.json 到 Cloudflare R2
```

## 为什么选静态 JSON

相比自建动态更新服务，当前项目更适合静态 manifest：

- 部署成本最低；
- 与现有 R2 分发模型一致；
- 没有额外后端；
- 可以先解决 90% 的自动升级需求。

如果后续需要灰度发布、渠道分流、回滚策略，再演进为动态更新服务。

## 落地改动

### 1.1 Rust / Tauri 配置

需要新增 Updater 插件：

- Rust: `tauri-plugin-updater`
- 前端: `@tauri-apps/plugin-updater`
- 通常还会配合 `@tauri-apps/plugin-process` 做安装后重启

`src-tauri/tauri.conf.json` 需要增加：

- `bundle.createUpdaterArtifacts = true`
- `plugins.updater.pubkey`
- `plugins.updater.endpoints`
- Windows 建议 `installMode = "passive"`

建议的 endpoint 形式：

```json
{
  "plugins": {
    "updater": {
      "pubkey": "<TAURI_PUBLIC_KEY>",
      "endpoints": [
        "https://<your-r2-public-domain>/updater/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

### 1.2 启动时机

推荐在 `src/routes/+page.svelte` 的 `onMount()` 内，在以下流程之后异步检查更新：

1. `registerStore()`
2. 默认文章加载完成
3. 文件打开监听初始化完成
4. 再执行 `checkForUpdates()`

原因：

- 避免首屏启动被更新检查阻塞；
- 保持当前 UI 初始化顺序不变；
- 便于将结果以现有 Modal / Alert 体系呈现。

### 1.3 前端分层

延续当前仓库约定，不要在页面里直接调用 updater API。

建议新增：

- `src/lib/bridge/updater.ts`
  - 封装 `check()`
  - 封装 `downloadAndInstall()`
  - 封装重启
- `src/lib/services/updateService.ts`
  - 业务判断：是否静默检查、是否弹窗、忽略版本、错误展示
- 可选：`src/lib/stores/localSettings.ts` 或复用现有设置体系
  - `autoCheckUpdate`
  - `skippedVersion`
  - `lastUpdateCheckAt`

## 用户体验建议

### MVP

- 启动后静默检查
- 如果有新版本，显示弹窗：
  - 当前版本
  - 新版本
  - 更新说明
  - 按钮：`立即更新` / `稍后`
- 下载完成后提示 `立即重启`

### 第二阶段

- 设置页新增：
  - `自动检查更新`
  - `检查更新`
- “关于”页显示：
  - 当前版本
  - 更新状态
  - 手动检查更新入口

当前 `AboutPage.svelte` 已经展示版本号，是很自然的入口。

## 发布链路改造

当前 `release.yml` 只做了：

- 构建 Windows 包
- 压缩 exe
- 上传到 R2

自动升级要补三件事：

### 1.4 签名

Tauri Updater **必须启用签名**，不能跳过。

需要生成并保管：

- public key：写入 `tauri.conf.json`
- private key：放在 GitHub Actions secrets

建议 secrets：

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### 1.4.1 `WENYAN_UPDATER_PUBKEY` 如何生成和配置

`WENYAN_UPDATER_PUBKEY` 是 **Tauri updater 公钥内容**，客户端会用它校验下载到的安装包签名。

生成方式：

```sh
pnpm tauri signer generate -- -w ~/.tauri/wenyan-updater.key
```

这条命令会生成一对 updater 签名密钥：

- 私钥：`~/.tauri/wenyan-updater.key`
- 公钥：通常是同目录下对应的 `.pub` 文件

配置方式：

- **GitHub Actions**
  - 私钥内容放到 `TAURI_SIGNING_PRIVATE_KEY` secret
  - 私钥密码放到 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret
  - 公钥内容放到 `WENYAN_UPDATER_PUBKEY` repository variable
- **本地 `.env`**
  - 推荐把公钥内容写到仓库根目录 `.env`
  - 如果用 `.env`，建议把换行转成 `\n`，例如：

```env
WENYAN_UPDATER_PUBKEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

当前实现会自动把字面量 `\n` 还原成真正换行。

如果想从生成好的公钥文件直接转成 `.env` 可用格式，可以用：

```sh
awk 'NF { sub(/\r/, ""); printf "%s\\\\n", $0 }' ~/.tauri/wenyan-updater.key.pub
```

然后把输出结果贴到 `WENYAN_UPDATER_PUBKEY="..."` 中即可。

### 1.4.2 `WENYAN_UPDATER_ENDPOINT` 如何生成和配置

`WENYAN_UPDATER_ENDPOINT` 是 **单个更新清单地址**，应直接指向最终上传后的 `latest.json`。

示例：

```env
WENYAN_UPDATER_ENDPOINT=https://downloads.example.com/updater/latest.json
```

这个值本身不需要“生成”，而是由你的分发域名和上传路径决定。按当前 workflow，最终推荐地址形态是：

```text
https://<your-r2-public-domain>/updater/latest.json
```

建议配置位置：

- 本地调试：仓库根目录 `.env`
- GitHub Actions：repository variable `WENYAN_UPDATER_ENDPOINT`

### 1.4.3 `WENYAN_UPDATER_ENDPOINTS` 如何生成和配置

`WENYAN_UPDATER_ENDPOINTS` 是 **多个更新清单地址**，用于多镜像或故障切换。

格式建议：

- 逗号分隔，或
- 多行分隔

示例：

```env
WENYAN_UPDATER_ENDPOINTS=https://mirror-a.example.com/updater/latest.json,https://mirror-b.example.com/updater/latest.json
```

当前实现的优先级是：

1. `WENYAN_UPDATER_ENDPOINTS`
2. `WENYAN_UPDATER_ENDPOINT`

也就是只要配置了 `WENYAN_UPDATER_ENDPOINTS`，单地址变量就会被忽略。

### 1.5 生成更新产物

开启 `createUpdaterArtifacts` 后，构建结果里会出现：

- `*.exe`
- `*.exe.sig`

这些文件需要和 `latest.json` 一起上传到 R2。

### 1.6 生成 `latest.json`

推荐在 workflow 中新增脚本，根据本次 release 版本和签名结果生成：

```json
{
  "version": "4.0.2",
  "notes": "修复若干已知问题，增加自动升级能力",
  "pub_date": "2026-04-29T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<sig file content>",
      "url": "https://<your-r2-public-domain>/updater/WenYan_4.0.2_x64-setup.exe"
    }
  }
}
```

建议固定上传到：

- `updater/latest.json`
- `updater/WenYan_<version>_x64-setup.exe`
- `updater/WenYan_<version>_x64-setup.exe.sig`

这样客户端配置可以长期不变。

### 1.6.1 `R2_PUBLIC_BASE_URL` 与 `latest.json` 的关系

当前 workflow 会使用 `R2_PUBLIC_BASE_URL` 生成：

- `updater/latest.json` 里的下载地址
- 推荐的 `WENYAN_UPDATER_ENDPOINT`

例如：

```env
R2_PUBLIC_BASE_URL=https://downloads.example.com
WENYAN_UPDATER_ENDPOINT=https://downloads.example.com/updater/latest.json
```

---

## 1.7 本地调试时如何从 `.env` 获取

当前仓库已经通过 `src-tauri/build.rs` 支持在 Rust 编译阶段读取 updater 配置。

支持的本地来源：

1. 进程环境变量
2. `src-tauri/.env`
3. 仓库根目录 `.env`

优先级从高到低就是上面的顺序。也就是说：

- shell 里显式 `export` 的值优先级最高
- `src-tauri/.env` 会覆盖仓库根 `.env`
- 两个 `.env` 都没有时，编译产物里就不会带 updater 配置

### 推荐本地调试方式

在仓库根目录创建 `.env`：

```env
WENYAN_UPDATER_ENDPOINT=http://127.0.0.1:8787/updater/latest.json
WENYAN_UPDATER_PUBKEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

如果你需要多个镜像地址，则改为：

```env
WENYAN_UPDATER_ENDPOINTS=http://127.0.0.1:8787/updater/latest.json,http://127.0.0.1:8788/updater/latest.json
WENYAN_UPDATER_PUBKEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

然后重新执行：

```sh
pnpm tauri:dev
```

或：

```sh
pnpm tauri:build
```

因为这些值是通过 Rust 编译期环境注入的，所以改完 `.env` 后需要重新编译一次，不能只刷新前端页面。

### 本地自测建议

最小闭环是：

1. 准备一份历史版本安装包
2. 本地启动一个静态文件服务，托管 `latest.json`、`.exe`、`.sig`
3. 在 `.env` 里把 `WENYAN_UPDATER_ENDPOINT` 指到这份 `latest.json`
4. 重新运行 `pnpm tauri:dev`
5. 通过“关于 -> 检查更新”验证发现更新、下载、安装流程

## 分阶段建议

### Phase 1

- 只支持 Windows 自动升级
- 使用静态 `latest.json`
- 启动静默检查 + 弹窗安装

### Phase 2

- 设置页提供手动检查更新
- 支持忽略某个版本
- 增加失败重试与下载进度反馈

### Phase 3

- 增加 macOS runner 和签名链路
- 增加 Linux runner
- 按平台输出完整 updater manifest

## 风险与注意事项

- **签名私钥不可丢失**。一旦丢失，历史安装用户将无法继续信任后续升级包。
- Windows 之外的平台现在没有构建产物，不能在 `latest.json` 里伪造平台项。
- `latest.json` 必须保证格式完整，Tauri 会先校验整份文件，再比较版本号。
- 升级检查必须异步，不能影响当前编辑器首屏加载。

---

## 2. 用户使用统计方案

## 推荐结论

推荐采用：

- **GA4 作为主统计方案**
- **Clarity 作为可选补充**

原因：

### 为什么主推 GA4

- 更适合做 **事件统计**：启动、打开文章、复制、导出、发布、更新成功等；
- 支持自定义事件与参数；
- 后续可接 BigQuery / Looker Studio；
- 既能前端埋点，也能扩展到 Rust 侧通过 Measurement Protocol 发送事件。

### 为什么 Clarity 只建议作为补充

- Clarity 更强在 **会话回放、点击热区、界面问题定位**；
- 对“桌面应用业务指标”支持不如 GA4 清晰；
- 自动升级、安装成功、失败原因这类事件更适合 GA4；
- 桌面 WebView 中跑 Clarity 可以做，但它更像“产品体验观察”而不是主数据仓。

结论：**如果只能选一个，选 GA4。**

## 推荐统计目标

先采“产品决策真正需要”的最小闭环，不要一开始采太多。

### 核心指标

- DAU / WAU / MAU
- 新增用户数
- 活跃版本分布
- 平台分布（windows / macos / linux）
- 功能使用率
- 发布成功率
- 自动升级成功率

### 建议事件

#### 生命周期事件

- `app_launch`
- `app_ready`
- `app_close`
- `app_crash`（后续阶段）
- `update_check`
- `update_available`
- `update_download_start`
- `update_install_success`
- `update_install_fail`

#### 内容编辑事件

- `article_open`
- `article_open_via_file`
- `article_create`
- `article_save`
- `image_upload`
- `image_upload_fail`
- `copy_html`
- `copy_text`
- `export_image`

#### 发布链路事件

- `publish_attempt`
- `publish_success`
- `publish_fail`
- `wechat_token_reset`

#### 配置与功能事件

- `theme_import`
- `theme_create`
- `theme_delete`
- `settings_open`
- `about_open`

## 事件参数建议

每个事件尽量带统一公共参数：

- `app_version`
- `platform`
- `arch`
- `channel`（stable / beta，后续可用）
- `is_tauri = true`

部分事件增加业务参数：

- `article_open`
  - `source`: `recent` / `dialog` / `system_open`
- `publish_*`
  - `platform_name`: `wechat`
  - `result`: `success` / `fail`
- `update_*`
  - `from_version`
  - `to_version`

## 埋点架构建议

沿用当前项目的前端桥接边界，建议分两层：

### 2.1 前端 analytics service

新增：

- `src/lib/services/analyticsService.ts`
- `src/lib/analytics/events.ts`

职责：

- 提供统一 `track(eventName, params)`
- 注入公共参数
- 做埋点开关判断
- 避免组件直接写 `gtag()` / `clarity()`

### 2.2 初始化位置

推荐在 `src/routes/+page.svelte` 的 `onMount()` 完成初始化：

- 初始化 GA4
- 可选初始化 Clarity
- 发送 `app_launch` / `app_ready`

功能事件则在现有服务层打点：

- `src/lib/services/fileOpenHandler.ts`
- `src/lib/services/copyHandler.ts`
- `src/lib/services/exportHandler.ts`
- `src/lib/services/imageUploadService.ts`
- `src/lib/services/wechatHandler.ts`
- `src/lib/setHooks.ts`
- 后续的 `updateService.ts`

## GA4 接入方式

## 推荐实现

### Phase 1：前端 Web Tag

直接在桌面 WebView 中加载 GA4：

- 在 `src/app.html` 注入 `gtag.js`
- 或在客户端初始化脚本里动态插入

优点：

- 实现最快；
- 适合先验证事件模型；
- 足以覆盖前端大部分用户行为。

缺点：

- 一些更底层的宿主事件不好采；
- ad blocker / 网络策略可能影响部分数据。

### Phase 2：Rust 补充 Measurement Protocol

对于更像“宿主事件”的数据，后续再从 Rust 侧发送到 GA4 Measurement Protocol：

- 自动升级检查结果
- 安装成功 / 失败
- 系统级异常

这部分更适合在 Tauri/Rust 层补充，而不是完全依赖前端脚本。

## Clarity 接入方式

如果要加 Clarity，建议只做：

- `app_launch`
- `about_open`
- `settings_open`
- 某些重点功能页的 session replay

并使用它的 API：

- `window.clarity("event", "...")`
- `window.clarity("set", "platform", "...")`

建议只在以下场景开启：

- 想看用户是否看得懂 UI；
- 想定位某些交互是否卡住；
- 想分析导入主题、复制、发布这类操作的路径。

不建议把 Clarity 当唯一统计源。

## 隐私与合规建议

这是桌面端必须先定下来的边界。

### 建议默认策略

- 首次启动弹出“数据统计说明”
- 提供开关：
  - `允许匿名使用统计`
  - `允许体验回放（仅 Clarity 开启时显示）`
- 默认建议：
  - **匿名统计：开启**
  - **体验回放：关闭**

如果面向更严格隐私地区，也可以默认全关闭，等用户主动开启。

### 严禁采集的数据

- Markdown 正文内容
- 用户发布内容
- AppID / AppSecret / AccessToken
- 本地文件路径原文
- 图片原始 URL（尤其带鉴权参数时）

### 允许采集的数据

- 版本号
- 平台类型
- 是否执行了某功能
- 是否成功
- 错误类别
- 文件是否来自系统打开 / 手动打开

## 建议配置项

建议在现有设置体系里增加：

- `analytics.enabled`
- `analytics.provider`
- `analytics.clarityEnabled`
- `analytics.userId`（匿名 UUID）
- `analytics.firstRunAt`
- `updater.autoCheck`
- `updater.skippedVersion`

其中匿名 ID 建议首次运行生成并保存在本地，用于：

- 去重 DAU
- 关联升级前后行为
- 不依赖登录体系

## 推荐实施顺序

### 第一步：最低风险 MVP

1. 接入 GA4
2. 只埋 8~10 个关键事件
3. 增加本地开关
4. 不接入 Clarity

这是最快看到数据、风险最低的一版。

### 第二步：自动升级

1. 接入 Tauri Updater
2. 先支持 Windows
3. 新增“检查更新”和自动更新提示
4. 记录更新事件到 GA4

### 第三步：体验分析增强

1. 再评估是否开启 Clarity
2. 只在明确需要录屏定位 UI 问题时上线
3. 默认关闭 session replay

---

## 3. 建议改动文件清单

## 自动升级

- `package.json`
  - 增加 updater / process 前端依赖
- `src-tauri/Cargo.toml`
  - 增加 `tauri-plugin-updater`
- `src-tauri/tauri.conf.json`
  - 增加 updater 配置
- `src-tauri/src/main.rs`
  - 注册 updater 插件
- `src/lib/bridge/updater.ts`
  - 封装检查 / 下载 / 安装 / 重启
- `src/lib/services/updateService.ts`
  - 更新业务逻辑
- `src/routes/+page.svelte`
  - 启动后异步检查更新
- `src/lib/components/AboutPage.svelte`
  - 增加“检查更新”入口
- `.github/workflows/release.yml`
  - 生成签名、latest.json、上传 updater 产物

## 用户统计

- `src/app.html`
  - 注入 GA4 / Clarity 初始化片段，或改为动态脚本装载入口
- `src/lib/services/analyticsService.ts`
  - 统一统计入口
- `src/lib/analytics/events.ts`
  - 事件名与参数定义
- `src/routes/+page.svelte`
  - 应用启动打点与初始化
- `src/lib/services/fileOpenHandler.ts`
- `src/lib/services/copyHandler.ts`
- `src/lib/services/exportHandler.ts`
- `src/lib/services/imageUploadService.ts`
- `src/lib/services/wechatHandler.ts`
- `src/lib/setHooks.ts`
  - 在现有业务动作处增加事件采集

---

## 4. 最终推荐

如果按“投入产出比”排序，我建议这样做：

1. **先上 GA4 最小埋点**
2. **再上 Windows 自动升级**
3. **最后再决定要不要接 Clarity**

这样最稳。

原因很简单：

- GA4 能最快回答“用户有没有在用、在用什么功能”
- Tauri Updater 能最快降低用户手动更新成本
- Clarity 价值更偏“体验诊断”，优先级低于前两者

## 一句话结论

- **自动升级：用 Tauri Updater + R2 静态 latest.json，先做 Windows**
- **用户统计：主用 GA4，Clarity 只做可选补充**
