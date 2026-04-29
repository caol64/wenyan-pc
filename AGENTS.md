# AGENTS.md for `wenyan-pc`

## Build, test, and lint commands

### Root app

- Use `pnpm`.
- Initial setup after clone: `git clone --recursive ...` or run `pnpm ui:sync` to populate/update the `wenyan-ui` submodule, then `pnpm install`.
- `pnpm web:install` installs dependencies and runs `svelte-kit sync`. CI uses this before desktop builds.
- `pnpm web:dev` starts the Svelte frontend only.
- `pnpm web:build` builds the frontend into `build/`.
- `pnpm tauri:dev` runs the desktop app in development mode.
- `pnpm tauri:build` packages the desktop app. `src-tauri/tauri.conf.json` runs `pnpm web:build` first.
- `pnpm tauri:info` shows Tauri environment details.
- `pnpm tauri:clean` cleans the Rust build output under `src-tauri/`.

### `wenyan-ui` submodule

- The root app aliases `@wenyan-md/ui` to `wenyan-ui/src/lib`, so edits there affect this app immediately.
- Build the UI package with `cd wenyan-ui && pnpm build`.
- Package-only step: `cd wenyan-ui && pnpm prepack`.

### Tests and linting

- There is currently no root `test` script, no single-test command, and no lint script in the root `package.json`.
- No root `*.test.*` / `*.spec.*` files are present.
- `wenyan-ui/AGENTS.md` also notes that the submodule currently has no repository test script, single-test command, or lint script.

## High-level architecture

- This repository is a SvelteKit frontend wrapped by a Tauri v2 desktop shell. The frontend lives in `src/`; the Rust host/backend lives in `src-tauri/`.
- The app boot path is `src/routes/+page.svelte`: it calls `setHooks()` to inject host-specific behavior into `@wenyan-md/ui`, registers persistence adapters with `registerStore()`, loads the default article, sets the initial platform to `"wechat"`, and wires the single-instance `open-file` event listener.
- The UI layer is shared through the `wenyan-ui` submodule, and the root app consumes the submodule source directly via aliases in `vite.config.ts` and `svelte.config.js`. Treat `@wenyan-md/ui` as live local source, not as a prebuilt external package.
- Frontend access to Tauri should go through `src/lib/bridge/*`. These modules wrap `invoke()`/`listen()` for articles, themes, credentials, uploads, publish actions, system utilities, and events.
- Frontend orchestration still lives in TypeScript services and adapters under `src/lib/`. Examples:
  - `storeRegister.ts` connects `@wenyan-md/ui` stores to this app's SQLite/localStorage adapters.
  - `services/fileOpenHandler.ts`, `markdownContentHandler.ts`, `imageUploadService.ts`, `wechatHandler.ts`, and `copyHandler.ts` coordinate UI actions, markdown/image processing, and publish flows.
  - `bridgeFsAdapter.ts` adapts the Tauri directory picker/reader to `FileSidebar`.
- Rust is split into command, application, infrastructure, DTO, and domain layers. `src-tauri/src/main.rs` registers plugins, initializes `DbManager`, emits the `open-file` event for second-instance launches, and exposes commands such as `open_markdown_file`, `load_themes`, `upload_image`, and `publish_wechat_draft`.
- Persistent desktop data lives in SQLite under the app data directory. `DbManager` creates the `CustomTheme`, `Article`, `Credential`, and `UploadCache` tables on first use.
- Default article loading is stateful: the backend returns the last saved article content if present, otherwise falls back to `src-tauri/resources/example.md`.

## Key conventions

- Keep Tauri calls behind `src/lib/bridge/*`. Components and higher-level services should consume bridge helpers instead of calling `invoke()` or `listen()` directly.
- Integrate desktop behavior into `@wenyan-md/ui` via injected hooks in `src/lib/setHooks.ts`. The root app customizes copy/export/publish/upload/file-open behavior by registering handlers rather than forking UI components.
- Register persistence through adapters, not ad hoc storage calls. `registerStore()` wires `themeStore`, `articleStore`, and `credentialStore` to SQLite-backed adapters while `settingsStore` stays on the UI library's localStorage adapter.
- Preserve the legacy migration paths in the SQLite adapters. Both article and credential adapters migrate old localStorage data into SQLite on first load.
- The last opened article path is part of the article persistence flow. `open_markdown_file` and `update_last_article_path` keep `fileName`, `filePath`, and `relativePath` in sync, and image resolution/upload logic depends on `getLastArticleRelativePath()`.
- File explorer results should keep using `bridgeFsAdapter` plus `filterAndSortEntries(...)` from `@wenyan-md/ui` so only supported entries reach the sidebar.
- Theme ID semantics matter. Draft custom themes use the `0:<baseThemeId>` pattern in the frontend, and the SQLite theme adapter converts `"0"`/falsy IDs to `null` so the backend creates a new persisted theme row.
- WeChat upload/publish flows are gated by UI settings and stored credentials. `imageUploadService.ts` and `wechatHandler.ts` expect `settingsStore.enabledImageHost === "wechat"` and a saved credential before calling the upload/publish bridges.
- Keep the `open-file` event name stable across frontend and Rust. Tauri single-instance startup and file-open handling both rely on that exact event bridge.
