# Tauri 自动升级时后台实际做了什么

本文只描述 **当前仓库的 Windows 自动升级链路**。重点是：当用户点击“检查更新”或应用启动后静默检查更新时，Tauri 和当前项目在后台实际做了哪些事。

---

## 1. 发布阶段：后台先准备好哪些文件

在用户设备发起更新前，GitHub Actions 已经先把升级所需文件准备好了：

1. `pnpm tauri:build` 生成 Windows NSIS 安装包。
2. Tauri bundler 在开启 `createUpdaterArtifacts` 后，同时生成：
   - `WenYan_<version>_x64-setup.exe`
   - `WenYan_<version>_x64-setup.exe.sig`
3. workflow 读取 `.sig` 文件内容，生成 `updater/latest.json`。
4. workflow 把下面三类文件上传到 R2：
   - `updater/latest.json`
   - `updater/WenYan_<version>_x64-setup.exe`
   - `updater/WenYan_<version>_x64-setup.exe.sig`

这一步完成后，客户端才有可能检查并安装更新。

---

## 2. 应用启动后，本仓库先做的事情

当前仓库里，自动升级入口在两处：

1. `src/routes/+page.svelte`
   - 应用启动后静默调用 `checkForUpdates({ silent: true })`
2. `src/lib/components/AboutPage.svelte`
   - 用户点击“检查更新”时调用 `checkForUpdates()`

在真正进入 Tauri updater 之前，前端会先做这些判断：

1. 判断当前是不是 Tauri 运行时。
2. 通过 `osType()` 判断当前是不是 Windows。
3. 调用 `is_updater_enabled`，确认当前构建是否真的带了 updater 配置：
   - `WENYAN_UPDATER_PUBKEY`
   - `WENYAN_UPDATER_ENDPOINT` 或 `WENYAN_UPDATER_ENDPOINTS`
4. 如果这些条件不满足，就直接提示，不会进入下载流程。

也就是说，**不是所有桌面运行都一定会触发真实的升级检查**，它先会判断当前环境是否具备自动升级能力。

---

## 3. Rust 侧收到“检查更新”后做了什么

前端并没有直接调用 `@tauri-apps/plugin-updater` 的 guest JS API，而是通过仓库自己的 command 进入 Rust：

1. 前端调用 `check_for_app_update`
2. Rust 进入 `src-tauri/src/application/update_service.rs`
3. `UpdateService` 做这几件事：
   1. 再次确认当前目标平台是 Windows
   2. 从编译期环境中读取：
      - `WENYAN_UPDATER_PUBKEY`
      - `WENYAN_UPDATER_ENDPOINTS`
      - `WENYAN_UPDATER_ENDPOINT`
   3. 把公钥中的 `\n` 还原成真正换行
   4. 把 endpoint 字符串拆成 URL 列表
   5. 调用 `app_handle.updater_builder()`
   6. 将公钥和 endpoints 注入 Tauri updater builder
   7. 调用 `.build()` 构造真正的 updater 实例

到这里为止，仓库自己的逻辑只是把“更新地址”和“验签公钥”交给 Tauri。

---

## 4. Tauri 在“检查更新”时后台默默做的事

当调用 `updater.check()` 后，Tauri updater 会在后台依次做这些事情：

1. 组装 HTTP 请求头，默认声明自己要获取 `application/json`
2. 确定当前运行平台标识
   - 对当前项目来说是 Windows
3. 依次请求配置的 updater endpoints
   - 如果配置了多个 endpoint，会按顺序尝试
   - 只有前一个返回非 2xx 或失败时，才会继续下一个
4. 拉取远端的 `latest.json`
5. 解析 `latest.json` 内容
6. 按平台查找本机对应的条目
   - 当前是 `windows-x86_64`
7. 从这个条目里拿到：
   - 目标版本号
   - 安装包下载 URL
   - 对应签名 `signature`
   - 更新说明 `notes`
   - 发布时间 `pub_date`
8. 比较当前版本和远端版本
9. 如果没有新版本，返回 `None`
10. 如果有新版本，返回一个 `Update` 对象给当前仓库的 `UpdateService`

这一步**只是在检查**，还没有下载和安装。

---

## 5. 用户确认“下载并安装”后，本仓库先做了什么

前端拿到新版本后，会弹出确认框。

当用户点击“下载并安装”时，当前仓库会先做：

1. 将 `globalState.isLoading = true`
2. 调用 Rust command：`install_app_update`
3. Rust 再次重新执行一次 `updater.check()`

这里的行为要注意：

- 当前仓库不是把第一次检查得到的 `Update` 对象长期缓存起来
- 而是在安装前 **重新做一次检查**

这样做的结果是：

1. 能确保安装时使用的是最新一次查询结果
2. 代价是会多发起一次 `latest.json` 请求

---

## 6. Tauri 在“下载更新”时后台默默做的事

在 Rust 侧调用 `update.download_and_install(...)` 后，Tauri 会继续执行：

1. 对安装包下载请求设置 `Accept: application/octet-stream`
2. 创建 HTTP 客户端
3. 请求 `latest.json` 中对应的安装包 URL
4. 检查响应状态码是否成功
5. 读取 `Content-Length`
6. 分块下载安装包二进制数据
7. 在下载过程中累计字节数
8. 下载完成后拿到完整安装包字节

对当前仓库来说，这一段是在后台完成的，前端目前**没有显示下载进度条**。

---

## 7. Tauri 在“验签”时后台默默做的事

下载完成后，Tauri 不会直接运行安装包，而是会先做签名校验：

1. 使用当前构建里内置的 `WENYAN_UPDATER_PUBKEY`
2. 使用 `latest.json` 里的 `signature`
3. 校验刚下载的安装包字节是否与签名匹配

只有验签通过，才会继续安装。

如果签名不匹配，更新会失败，当前仓库会把错误显示为“安装更新失败”。

这一步就是为什么：

- 同一个 `setup.exe` 既可以独立安装
- 但自动升级时还必须额外依赖 `.sig` 和公钥

因为自动升级比手动安装多了一步 **可信来源校验**。

---

## 8. Tauri 在 Windows 上“准备安装”时后台默默做的事

验签通过后，Tauri 会进入 Windows 安装逻辑：

1. 判断下载到的是：
   - NSIS 安装器
   - 或 MSI 安装器
2. 从当前运行进程里拿到启动参数
3. 组装安装器命令行参数

对于当前仓库使用的 NSIS，Tauri 会额外附加：

1. 安装模式对应参数
   - 当前 `tauri.conf.json` 配的是 `passive`
2. `/UPDATE`
3. `/ARGS`
4. 当前应用启动参数
5. 额外 installer 参数（如果配置过）

`/UPDATE` 这个标记是关键，它告诉 NSIS：这次不是普通首次安装，而是 updater 驱动的更新安装。

---

## 9. Tauri 在真正启动安装器前后台做了什么

在 Windows 上真正拉起安装器前，Tauri 还会做最后一步清理：

1. 执行 `on_before_exit`
   - 当前插件内部会先做应用退出前清理
2. 调用 Windows `ShellExecuteW`
   - 直接启动下载好的安装器
3. 传入上一步组装好的安装参数
4. 然后当前应用进程调用 `std::process::exit(0)` 立即退出

所以从用户视角看起来就是：

1. 点击“下载并安装”
2. 应用自己关闭
3. 安装器弹出来并继续执行

这不是前端主动调用 `window.close()`，而是 Tauri updater 在 Windows 安装逻辑里主动退出当前进程。

---

## 10. 安装器接手后，还会发生什么

一旦 `setup.exe` 被拉起，后续就不再是 Svelte 前端控制，而是 NSIS 安装器接手：

1. 安装器覆盖旧版本文件
2. 处理快捷方式、安装目录等 NSIS 逻辑
3. 根据 updater 传入的参数决定是否自动重新拉起应用

也就是说：

- **检查更新**
- **拉取 manifest**
- **下载**
- **验签**
- **启动安装器**

这些是 Tauri updater 在当前应用进程里完成的。

而真正的“覆盖安装”是安装器自己完成的。

---

## 11. 当前仓库里，后台没有做的事

为了避免误解，这些事情当前实现里 **还没有**：

1. 没有下载进度 UI
2. 没有“忽略此版本”
3. 没有灰度发布 / 分渠道更新
4. 没有失败重试
5. 没有更新事件埋点
6. 没有把第一次 `check()` 的结果缓存后直接安装

所以当前实现属于：

- **能工作**
- **路径清晰**
- **Windows-only**
- **MVP 级自动升级**

---

## 12. 一句话总结

在当前仓库里，Tauri 自动升级的后台流程可以概括成：

1. 读取内置的 updater 公钥和 `latest.json` 地址
2. 请求远端 `latest.json`
3. 找到 `windows-x86_64` 对应的安装包和签名
4. 比较版本
5. 下载 `setup.exe`
6. 用公钥校验签名
7. 拼好 NSIS 更新参数
8. 启动安装器
9. 退出当前应用
10. 由安装器完成覆盖安装
