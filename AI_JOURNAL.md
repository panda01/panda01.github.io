# AI Journal

Newest entries first.

---

## 2026-10-12 15:40 EDT — Phase 2 started: decisions, libraries, and the failing E2E spec (red)

**Intent:** Start Phase 2 (Finder, Quick Look, Spotlight) as the plan's workflow requires: decisions first, then the E2E spec written before any code, run to confirm it fails for the right reason.

**User decisions (2026-10-12):**

- **No uploads, ever.** Visitors can only download. The plan file was updated: Phase 2's E2E list, tasks and "You check" no longer mention uploads, and a "No uploads" task was added. Project memory records it too.
- **Drag-and-drop:** @dnd-kit/core.
- **Quick Look:** no Markdown rendering ("there will be no markdown files"); plain text, images and PDF only.
- **Spotlight:** Fuse.js fuzzy search.
- **Download:** files only, no folder zips.

**Pre-flight:** all earlier tests passed just before this: 291 unit tests and 38/38 E2E.

**Libraries installed** (`apps/web/package.json`, exact versions, all with bundled types):

- `react-pdf` 11.0.0.
- `pdfjs-dist` 6.3.289: the exact version react-pdf uses, added directly so its worker file can be imported.
- `@dnd-kit/core` 6.3.1.
- `fuse.js` 7.5.0.

**Files added:**

- `e2e/support/finder-test-helpers.mts`:
  - `findWindowTitled`, `folderContentsOf`, `folderItemIn`, `desktopItemNamed`;
  - `openFinderFromDock`, `goToSidebarLocation`, `chooseFromContextMenu`, `createNamedFolderInFinder`;
  - `dragElementOnto`;
  - `stubExternalWebsites`: GitHub and LinkedIn answered locally;
  - `storeFileInVisitorDesktop`: writes a fixture file straight into IndexedDB, because visitors can't upload and the image test needs an image.
- `e2e/phase-2-finder.spec.mts`, 16 tests:
  - Finder from the Dock, with the sidebar;
  - navigation with title, path bar and back/forward;
  - icon, list and column views;
  - New Folder with inline rename, then Rename;
  - drag into a folder, and Duplicate;
  - Trash, Put Back, drag to the sidebar Trash, and Empty;
  - drag to the Dock Trash, and the Dock Trash opening in Finder;
  - Get Info;
  - download, plus no upload anywhere and computer file drops blocked;
  - Quick Look for text and PDF;
  - Quick Look for an image;
  - a link opening a new tab;
  - desktop items opening in Finder and Quick Look;
  - Spotlight, including a typo and ⌥Space;
  - live desktop sync and reload persistence;
  - axe.

**Red run:** `npx playwright test e2e/phase-2-finder.spec.mts` (Chromium + WebKit) → **32 failed**, all for the expected reason, because nothing exists yet:

- no "Finder" button in the Dock;
- no "Spotlight" button in the menu bar;
- desktop folders and aliases don't open;
- dragging a desktop icon onto the Dock Trash does nothing.

---

## 2026-10-12 14:55 EDT — Real GitHub, LinkedIn and resume on the default desktop (Phase 1 approved)

**Intent:** The user approved Phase 1 and asked for their real content: GitHub `panda01`, LinkedIn `khalahjonesgolden`, and their resume PDF (which they had placed at the repo root) moved wherever is best. It now replaces the placeholder `content/Desktop/Resume.pdf`, so it keeps the Desktop name "Resume.pdf" that the seed, the tests and the Phase 2 Quick Look/Spotlight plan already use.

**Changes:**

- **Moved** `Khalah C. Jones - Golden Resume 2026.pdf` (repo root) → `content/Desktop/Resume.pdf`, replacing the 685-byte placeholder. It is a 2-page PDF of 129,602 bytes. Permissions were changed from 600 to 644 to match the other content files.
- `apps/web/src/system/seed/default-desktop-seed.mts`
  - `currentSeedVersion`: 1 → 2, so returning visitors receive the new resume.
  - `defaultDesktopSeedEntries`: the GitHub link is now `https://github.com/panda01` and the LinkedIn link `https://www.linkedin.com/in/khalahjonesgolden/`.
  - The JSDoc on `defaultDesktopSeedEntries` now says which content is real and which is still placeholder (About Me, the project READMEs, the Email address).
- `apps/web/src/system/seed/desktop-seeding.test.mts`: added the test "links the desktop's GitHub and LinkedIn shortcuts to the owner's profiles".
- `apps/web/src/shell/desktop/DesktopSurface.test.tsx`: the expected `window.open` URL for GitHub is now `https://github.com/panda01`. The functionality changed at the user's request.

**Verification:**

- **Automated:**
  - `npm run verify` exit 0: 291 tests; coverage 99.71 / 98.1 / 100 / 99.71.
  - `npx playwright test`: 38/38 passed.
- **Profiles:** `https://github.com/panda01` returns 200. LinkedIn answers non-browser requests with 999, so it can't be checked with curl.
- **Manual (Playwright, dev server):** health `{"status":"ok"}` and the homepage sniff test passed. The profile pages were stubbed locally, so only the opened URLs were checked:
  - double-clicking GitHub opens `https://github.com/panda01`;
  - double-clicking LinkedIn opens `https://www.linkedin.com/in/khalahjonesgolden/`;
  - Get Info on Resume.pdf shows PDF Document, 130 KB;
  - the stored bytes are 129,602 and start with `%PDF-1.4`;
  - no console problems.
- **Returning visitor (simulated):** IndexedDB was rewound to seed version 1 with a placeholder resume and the old GitHub URL, then the page reloaded.
  - The resume upgraded to the real one (130 KB).
  - The GitHub link kept the old URL. This is the existing seeding design: seed upgrades refresh unchanged files but never rewrite links already delivered.
  - Browsers that visited before today need Reset Desktop to get the new links.
- Dev servers stopped; project ports free; no neko container running.

---

## 2026-10-12 11:30 EDT — Phase 1 built: desktop shell, filesystem, windows, Dock, menu bar (awaiting user check)

**Intent:** Build Phase 1 of the plan: a persistent virtual filesystem with the seeded default desktop, and the macOS-style shell (boot screen, menu bar, Dock, desktop icons, windows, About This Mac, Get Info), shortcuts and Reset. The aim is to make the Phase 1 E2E tests written on 2026-10-11 pass.

**Gate results:**

- `npm run verify` exits 0: 290 unit tests; coverage 99.71% statements, 98.1% branches, 100% functions, 99.71% lines.
- `npm run test:e2e`: 38/38 pass (Phase 0 + Phase 1 on Chromium and WebKit, plus neko).
- Manual Playwright walkthrough (`claude_tmp/phase-1/manual-walkthrough.mts`, screenshots in `claude_tmp/phase-1/screens/`): 17 steps in light mode plus a dark-mode pass; 0 console warnings or errors.

**Decision with the user:** react-rnd's dragging (via react-draggable) lost 12–25 px of movement in WebKit, failing 3–4 of 8 runs.

- **Cause:** each move was applied as "previous position + delta", and React 18+ defers state from rapid moves, so a delta could be dropped.
- **User chose:** our own title-bar drag; react-rnd is kept for positioning and resizing. Each move now places the window at start + total pointer movement.
- **Result:** 80/80 repeated drag/resize/z-order/persistence runs pass.

**Bugs found and fixed during the phase (each has a regression test):**

1. **Desktop icons stopped updating** (new folders never appeared; the desktop was empty after Reset). Dexie `liveQuery` lost read-tracking across the filesystem's nested awaits and ended permanently on its first error. `useLiveQueryResult` now re-runs after any committed write (`Dexie.on.storagemutated`), keeps only the newest result, and recovers from failed runs.
2. **File bytes were lost after Put Back/rename/move.** Dexie `update()` deep-clones records and dropped cross-realm `Uint8Array`s under jsdom. The filesystem now saves full records with re-wrapped bytes (`saveRecord` / `withLocalContentCopy`).
3. **Double-clicking a zoomed window re-zoomed it.** A press without movement counted as a move. Moves and resizes are now saved only when the bounds change.
4. **Focusing a window moved it in the DOM** (windows were rendered in stacking order), which would reload iframes such as the Phase 4 Browser. Windows now render in opening order and stack by z-index.
5. **The Dock right-click menu showed stale state** ("Empty Trash" stayed disabled). The menu now looks up the item's current state.
6. **Clicking the top window still rewrote the stacking order.** Focusing the window that is already on top is now a no-op.

**Test replaced:** the two Phase 0 placeholder tests in `App.test.tsx` checked the old static "khalah.com" heading. That placeholder was replaced by the approved Phase 1 desktop (the name now lives in About This Mac), so they now check boot screen → desktop landmark, plus the recovery actions.

**Files added:**

- **Filesystem (`apps/web/src/system/fs/`):**
  - `path-utilities.mts`: `splitPathIntoNames`, `normalizePath`, `joinPath`, `getParentPath`, `getBaseName`, `isPathInsideFolder`, `isValidItemName`, and path constants.
  - `file-system-errors.mts`: `FileNotFoundError`, `FileAlreadyExistsError`, `WrongItemKindError`, `InvalidFileOperationError`, `StorageQuotaExceededError`, `isQuotaExceededError`.
  - `file-system.types.mts`.
  - `mime-types.mts`: `splitNameAndExtension`, `guessMimeTypeFromFileName`.
  - `virtual-file-system.mts`:
    - helpers: `buildNumberedName`, `buildCopyName`, `createRandomItemId`;
    - class `VirtualFileSystem`: `ensureRootFolder`, `findItem`, `getItem`, `exists`, `listFolder`, `createFolder`, `writeFile`, `readFileBytes`, `createLink`, `rename`, `move`, `copy`, `remove`, `moveToTrash`, `putBack`, `emptyTrash`, `setSeedFingerprint`, `createUniqueChildName`.
  - `item-presentation.mts`: `chooseItemIconKind`, `describeItemKind`, `formatByteSize`, `formatItemTimestamp`.
- **Storage (`apps/web/src/system/storage/`):**
  - `desktop-database.mts`: `DesktopDatabase`, `openDesktopDatabase` (in-memory fallback through fake-indexeddb).
  - `persistent-storage.mts`: `requestPersistentStorage`.
  - `delete-saved-desktop.mts`: `deleteSavedDesktop`.
- **Seed (`apps/web/src/system/seed/`):**
  - `default-desktop-seed.mts`: `currentSeedVersion`, `defaultDesktopSeedEntries`.
  - `desktop-seeding.mts`: `computeContentFingerprint`, `seedDesktop` (upgrades never resurrect deleted items or overwrite edited ones), `resetDesktop`.
  - `seed-content-loader.mts`: `createSeedContentLoader`.
  - `content/`: placeholder About Me.txt, Resume.pdf and two example projects (for the owner to replace).
- **Window manager (`apps/web/src/system/window-manager/`):**
  - `window.types.mts`.
  - `window-geometry.mts`: `clampWindowBoundsToDesktopArea`, `computeCascadedWindowBounds`, `computeZoomedWindowBounds`.
  - `window-manager-store.mts`:
    - `createWindowManagerStore`, a Zustand store with actions `openWindow`, `closeWindow`, `closeAllWindowsOfApp`, `focusWindow`, `minimizeWindow`, `restoreWindow`, `toggleWindowZoom`, `moveWindow`, `resizeWindow`, `setDesktopAreaSize`, `replaceAllWindows`, `setInterfaceMode`;
    - selectors: `selectWindowsInStackOrder`, `selectWindowsInOpeningOrder`, `selectFocusedWindow`, `selectFocusedAppId`.
  - `window-layout-persistence.mts`: `loadPersistedWindowLayout`, `toPersistedWindowRecords`, `startPersistingWindowLayout`.
- **Other system modules:**
  - `app-registry/app-manifest.types.mts`.
  - `app-registry/app-registry.mts`: `appManifests`, `findAppManifest`, `buildOpenWindowRequest`.
  - `desktop-session/desktop-session.mts`: `startDesktopSession`.
  - `desktop-session/desktop-session-context.tsx`: `DesktopSessionProvider`, `useDesktopSession`, `useWindowManager`, `useOpenApp`.
  - `hooks/use-live-query-result.mts`: `useLiveQueryResult`.
  - `keyboard/desktop-keyboard-shortcuts.mts`: `resolveDesktopShortcutAction`, `isTextEntryTarget`.
  - `keyboard/full-screen-keyboard-lock.mts`: `findKeyboardLockApi`, `enterFullScreenWithKeyboardLock`, `exitFullScreenAndReleaseKeyboard`.
  - `notices/desktop-notice-store.mts`: `useDesktopNoticeStore`, `describeFailedAction`.
  - `theme/desktop-theme.mts`: `createDesktopTheme`.
- **Shell (`apps/web/src/shell/`):**
  - `DesktopShell.tsx`.
  - `boot/`: `BootScreen.tsx`, `DesktopBootGate.tsx` (`measureInitialDesktopAreaSize`), `RootErrorBoundary.tsx`.
  - `menu-bar/`: `MenuBar.tsx`, `MenuBarClock.tsx`, `menu-bar-menus.mts` (`buildMenuBarMenus`), `menu-bar-clock-format.mts` (`formatMenuBarClock`).
  - `dock/`: `Dock.tsx`, `DockItem.tsx`, `dock-entries.mts` (`buildDockEntries`, `listDockMenuActions`, `describeDockEntry`, `computeNextDockFocusIndex`), `dock-magnification.mts` (`computeMagnifiedIconSize`).
  - `desktop/`: `DesktopSurface.tsx`, `DesktopIcon.tsx`, `Wallpaper.tsx`, `ResetDesktopDialog.tsx`, `DesktopNoticeSnackbar.tsx`, `desktop-actions.mts` (`createUntitledFolder`, `canOpenItem`, `openDesktopItem`, `openUrlInNewBrowserTab`), `desktop-menu.mts` (`listDesktopMenuActions`).
  - `window/`: `DesktopWindow.tsx`, `WindowLayer.tsx`, `TrafficLights.tsx`, `WindowErrorBoundary.tsx`, `lazy-window-content.mts` (`lazyWindowContentByAppId`), `window-frame-handlers.mts` (`createWindowFrameHandlers`), `use-title-bar-drag.mts` (`computeDraggedWindowPosition`, `useTitleBarDrag`).
  - `keyboard/`: `use-desktop-keyboard-shortcuts.mts` (`performDesktopShortcutAction`, `useDesktopKeyboardShortcuts`), `use-full-screen-state.mts` (`useFullScreenState`).
  - `icons/`: `item-icons.tsx` and `system-icons.tsx` (original SVG artwork).
- **Apps:** `apps/about-this-mac/AboutThisMac.tsx`; `apps/get-info/GetInfo.tsx` (`buildItemInfoRows`).
- **Test support:** `apps/web/src/test-support/desktop-test-session.tsx`, plus 24 new `*.test.*` files.

**Files changed:**

- `apps/web/src/App.tsx`: theme, MotionConfig, `RootErrorBoundary`, `DesktopBootGate`; added `reloadPage` and `deleteSavedDesktopAndReload`.
- `apps/web/src/main.tsx`: Inter font imports.
- `apps/web/src/test-setup.mts`: animations skipped; pointer-capture stand-ins for jsdom.
- `apps/web/package.json`: fake-indexeddb is now a runtime dependency, used by the in-memory fallback.
- `e2e/phase-1-desktop.spec.mts`:
  - reduced motion, so geometry is measured outside animations;
  - the first z-order check now retries while the menu closes.
- Plan file: Phase 1 keyboard decision and Get Info sequencing.

---

## 2026-10-11 13:10 EDT — Phase 1: dependencies, shortcut decision, E2E tests written first (red run)

**Intent:** Start Phase 1 (core system and desktop shell) by agreeing the shortcut map, installing the planned libraries, and writing the Phase 1 E2E acceptance tests before any feature code.

**Decisions with the user:**

- **Shortcuts:**
  - ⌥ Option keys everywhere: ⌥W close, ⌥Q quit, ⌥M minimize, ⌥N new window, ⌥Tab switcher (Phase 5), ⌥Space Spotlight (Phase 2). They are ignored in text fields and the Terminal.
  - Real ⌘ shortcuts work in full-screen on Chrome/Edge through the Keyboard Lock API.
- **Sequencing (recorded in the plan):** Get Info windows were pulled forward from Phase 2 so Phase 1 has two simultaneous windows for the z-order test.

**Dependencies added to `@khalah/web`** (exact versions, all with bundled types): dexie 4.4.6, zustand 5.0.15, react-rnd 10.5.3, motion 14.1.0, @mui/icons-material 9.5.0, @fontsource/inter 5.3.0.

**Red run:** `npx playwright test e2e/phase-1-desktop.spec.mts --project=desktop-chromium` gave 13 failed, all for the expected reason (the boot-screen progressbar and the "Menu bar" navigation do not exist yet).

**Files added:**

- `e2e/support/desktop-test-helpers.mts`: added `openDesktopAndWaitForBoot()`, `waitForDesktopBootToFinish()`, `measureElement()`, `dragElementBy()`, `findSeriousAccessibilityViolations()`.
- `e2e/phase-1-desktop.spec.mts`: 13 acceptance tests; added helpers `openAboutThisMacFromDock()` and `openGetInfoForDesktopItem()`.

**Files changed:**

- `apps/web/package.json`: new dependencies.
- Plan file: Phase 1 keyboard decision and Get Info sequencing.

---

## 2026-10-11 12:54 EDT — Phase 0 complete: foundation built, spikes done, gate green

**Intent:** Finish Phase 0. Build the features the red E2E tests demanded (app root, health route, neko infrastructure), run the three throwaway spikes, manually verify, and pass the automated gate. Phase 0 has no user check, per the plan.

**Gate results:**

- `npm run verify` exits 0: typecheck (4 projects), lint, format, and 19 unit tests at **100%** statements/branches/functions/lines.
- `npm run test:e2e` exits 0: **12/12 passed** (desktop-chromium, desktop-webkit, neko setup/tests/teardown).

**Manual verification (Playwright MCP + curl):**

- Checks passed:
  - `npm run dev`: Vite ready on 5317, API on 5318.
  - `curl /api/health` returned 200 `{"status":"ok"}`.
  - `npm run dev:check` reported both checks ok.
  - The homepage snapshot shows `main "khalah.com desktop"` and the heading.
  - The neko stream showed the remote page in kiosk mode, with typed text and a click visible.
- Teardown: `npm run dev:stop` stopped 10 dev-session processes, `neko:down` ran, and all 7 project ports were free afterwards.
- **Found and fixed:** real browsers request a favicon (the headless E2E browsers don't), which caused a 404 console error.
  - A regression E2E test was written first and failed for the expected reason (no `<link rel="icon">`).
  - Fixed by adding an original SVG favicon. The console now shows 0 errors.

**Spike findings** (throwaway scripts in `claude_tmp/spikes/`, not part of the project):

1. **just-bash (v3.6.0)**
   - `BashOptions.fs` accepts a custom `IFileSystem`.
   - The interface is **async**; only `resolvePath` and `getAllPaths` are sync, and globs work even when `getAllPaths()` returns `[]`.
   - `new Bash()` seeds `/bin` etc. through InMemoryFs-only sync helpers. Mounting an async-only filesystem at `/Users/guest` via `MountableFs` (in-memory base) works for every command tested. Mounted filesystems receive mount-relative paths.
   - cwd/env reset on each `exec()`, but `result.env` (including `PWD`) can be passed into the next `exec({ cwd, env })` to keep them.
   - `AbortSignal` cancels `sleep 10` in about 100 ms (exit 124). `defineCommand` custom commands work.
   - **Design for Phase 3:** a Dexie async adapter mounted at the home folder.
2. **Dexie (4.4.6) + fake-indexeddb under jsdom**
   - A **Blob is lost**: it comes back as `{}`.
   - `Uint8Array`/`ArrayBuffer` keep every byte but fail `instanceof` (a cross-realm mismatch).
   - **Design for Phase 1:** store file content as `Uint8Array`, create Blobs only at the UI edge, and use `ArrayBuffer.isView` / re-wrap instead of `instanceof`.
3. **neko (chromium:3.1.6 arm64 on Docker Desktop)**
   - Healthy about 12–16 s after `neko:up` (base image cached; first pull ~650 MB).
   - Memory: ~300 MiB idle, ~350–560 MiB while streaming at ~31–36% of one CPU.
   - The WebRTC stream plays in Playwright Chromium.
   - Kiosk mode + CDP via socat work.
   - **Keyboard and mouse input work in both `?cast=1` and `?embed=1`.**
   - **Touch taps arrive as mouse clicks** (no touch events).
   - `POST /api/room/screen` with the API token resizes the stream in ~30–60 ms.
   - The shipped client can only log in automatically via `usr`/`pwd` URL params (no token param), so local dev will use a random per-container password on localhost, as the plan allowed.
   - **Risks for Phase 4 (need decisions then):**
     - (a) In kiosk mode, neither `Page.bringToFront` nor `Target.activateTarget` changes which tab is displayed, so tab switching needs another approach.
     - (b) The force-installed SponsorBlock extension opens a welcome tab on first boot that covers the screen.
     - (c) The `chrome://*` blocklist entry also blocks `chrome://newtab`, so blank new tabs show "This page is blocked".

**Files added:**

- `apps/server/src/routes/health.mts`: added `handleHealthCheckRequest()` (GET /api/health) and `createHealthRouter()`.
- `apps/web/src/App.tsx`: added `App()`.
- `apps/web/src/main.tsx`: added the `applicationMountElement` variable.
- `apps/web/src/test-setup.mts`: added `createNonMatchingMediaQueryList()`, `ignoreListenerRegistration()`, `reportEventNotDispatched()` and the `ResizeObserverThatNeverReports` class.
- `apps/web/public/favicon.svg`.
- `scripts/stop-dev-servers.mts`: added `findListeningProcessIds()`, `describeProcess()`, `collectDevSessionProcessIds()`, `sendTerminateSignal()`, `stopProjectDevServers()`.
- `scripts/check-dev-servers.mts`: added `findApiHealthProblem()`, `findHomepageProblem()`, `checkDevServers()`.
- `infra/neko/Dockerfile`, `chromium.conf`, `devtools-forwarder.conf`, `policies.json`, `compose.yaml`.
- Tests: `apps/server/src/app.test.mts`, `apps/server/src/routes/health.test.mts`, `apps/server/src/neko-infrastructure-ports.test.mts`, `apps/web/src/App.test.tsx`, `packages/shared/src/ports.test.mts`.

**Files changed:**

- `apps/server/src/app.mts`: `createApp()` now mounts the health router.
- `apps/web/index.html`: added the favicon link.
- `e2e/phase-0-foundation.spec.mts`: added the favicon regression test.
- `packages/shared/src/api-types.mts`: renamed to `api.types.mts` (type-only naming convention); `index.mts` updated.
- `package.json`: the `typecheck` script uses `tsc -b apps/web`.
- `tsconfig.json`: added the DOM lib for E2E `page.evaluate` callbacks.
- `eslint.config.mts`: preset spreads now come before the `name`/`files` overrides.
- `.gitignore` / `.prettierignore`: added `.playwright-mcp/`, the Playwright MCP tool's snapshot/log output folder.
- Prettier reformatted 4 files.

---

## 2026-10-11 12:40 EDT — Phase 0: tooling scaffold + E2E tests written first (red run)

**Intent:** Start Phase 0 of the approved plan (`~/.claude/plans/i-would-like-to-lovely-hennessy.md`). Set up the npm-workspaces monorepo, frozen lint/format/test configs, and write the Phase 0 E2E tests _before_ any feature code, then confirm they fail for the expected reasons.

**Decisions made with the user during this step:**

- TypeScript pinned to **6.0.3**: typescript-eslint 8.71.1 only supports TypeScript `<6.1`, and the latest is 7.0.2.
- Accessibility lint uses **eslint-plugin-jsx-a11y-x 0.2.0** (MIT, maintained es-tooling fork). The original plugin doesn't support ESLint 10 (its support PRs are still unmerged).
  - Verified in a scratch project: on ESLint 10.12 with type-aware typescript-eslint, a deliberately broken component produced 7 a11y errors and a correct one produced 0.

**Red run (`npx playwright test`):** 6 failed, 4 did not run. All failures had the expected causes:

- `GET /api/health` returned **404** (route not built yet).
- The homepage had no `main` landmark named "khalah.com desktop" (app not built yet).
- `neko-setup` failed because `infra/neko/compose.yaml` doesn't exist yet, so the 4 neko tests did not run (they fail rather than skip).

**Files added:**

- **Root:** `package.json`, `.gitignore`, `.nvmrc`, `.env.example`, `.env` (gitignored, random secrets), `.prettierignore`, `prettier.config.mts`, `eslint.config.mts`, `vitest.config.mts`, `playwright.config.mts`, `tsconfig.base.json`, `tsconfig.json`.
  - Root `package.json` scripts: `dev`, `dev:web`, `dev:api`, `dev:stop`, `dev:check`, `e2e:web`, `e2e:api`, `build`, `typecheck`, `lint`, `format`, `format:check`, `test`, `test:coverage`, `test:e2e`, `neko:up`, `neko:down`, `verify`.
- **`packages/shared/`:**
  - `package.json`, `tsconfig.json`.
  - `src/ports.mts`: added `localLoopbackHost`, `developmentPorts`, `endToEndTestPorts`, `resolvePortFromEnvironment()`.
  - `src/api.types.mts`: added the `HealthCheckResponse` interface.
  - `src/index.mts`: barrel.
- **`apps/server/`:**
  - `package.json`, `tsconfig.json`.
  - `src/app.mts`: added `createApp()`, with no routes yet.
  - `src/index.mts`: listen bootstrap; added the `apiServerPort` variable.
- **`apps/web/`:** `package.json`, `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`, `vite.config.mts` (variables `webApplicationPort`, `apiServerPort`), `index.html`.
- **`e2e/`:**
  - `phase-0-foundation.spec.mts`.
  - `phase-0-neko-infrastructure.neko.spec.mts`: added `readRequiredEnvironmentVariable()`.
  - `neko.setup.mts`, `neko.teardown.mts`.

**Notes:**

- npm's allow-scripts guard skipped the `esbuild` and `fsevents` install scripts. tsx and Vite both work without them, so `allowScripts` was not changed.
- Playwright 1.64 browsers (Chromium 1248, WebKit 2370) were installed into the standard `~/Library/Caches/ms-playwright`.
- The scratch folder `claude_tmp/a11y-lint-test/` couldn't be deleted by the agent (a safety check blocked the removal). It is gitignored and safe for the user to delete.
