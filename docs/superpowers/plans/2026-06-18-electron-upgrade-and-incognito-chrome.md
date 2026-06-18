# Electron Upgrade and Incognito Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Google login inside Electron with a system Chrome incognito flow and upgrade Electron to 42.4.1.

**Architecture:** A small main-process launcher invokes the system Google Chrome executable directly and returns a structured result through the existing system IPC boundary. The renderer becomes a single-column account form with a prominent launch button; all webview-only capabilities are removed. Launcher behavior is covered by Vitest, while typecheck/build and a manual launch check cover integration.

**Tech Stack:** Electron 42.4.1, React 18, TypeScript, Vitest, pnpm, macOS Google Chrome

---

### Task 1: Add the test harness and specify Chrome launch behavior

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/main/system/chrome-launcher.test.ts`

- [ ] **Step 1: Add Vitest and the test script**

Add `"test": "vitest run"` to `scripts` and `"vitest": "^3.2.4"` to `devDependencies`, then run:

```bash
pnpm install --lockfile-only
```

Expected: `package.json` and `pnpm-lock.yaml` resolve Vitest without changing application behavior.

- [ ] **Step 2: Write the failing launcher tests**

Create `src/main/system/chrome-launcher.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { APP_PASSWORD_URL, openAppPasswordInIncognitoChrome } from './chrome-launcher';

describe('openAppPasswordInIncognitoChrome', () => {
  it('opens the app-password page in a new Chrome incognito instance', async () => {
    const run = vi.fn(async () => undefined);

    const result = await openAppPasswordInIncognitoChrome(run);

    expect(result).toEqual({ ok: true });
    expect(run).toHaveBeenCalledWith(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ['--incognito', APP_PASSWORD_URL],
    );
  });

  it('returns a Chinese error when Chrome cannot be opened', async () => {
    const run = vi.fn(async () => {
      throw new Error('application not found');
    });

    const result = await openAppPasswordInIncognitoChrome(run);

    expect(result).toEqual({
      ok: false,
      error: '无法打开 Google Chrome：application not found',
    });
  });
});
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
pnpm test -- src/main/system/chrome-launcher.test.ts
```

Expected: FAIL because `./chrome-launcher` does not exist.

### Task 2: Implement the tested launcher and expose it through IPC

**Files:**
- Create: `src/main/system/chrome-launcher.ts`
- Modify: `src/main/ipc/system.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Implement the minimal launcher**

Create `src/main/system/chrome-launcher.ts`:

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const APP_PASSWORD_URL = 'https://myaccount.google.com/apppasswords';

export interface ChromeLaunchResult {
  ok: boolean;
  error?: string;
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<void>;

const execFileAsync = promisify(execFile);
const runCommand: CommandRunner = async (command, args) => {
  await execFileAsync(command, [...args]);
};

export async function openAppPasswordInIncognitoChrome(
  run: CommandRunner = runCommand,
): Promise<ChromeLaunchResult> {
  try {
    await run(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      ['--incognito', APP_PASSWORD_URL],
    );
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `无法打开 Google Chrome：${message}` };
  }
}
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```bash
pnpm test -- src/main/system/chrome-launcher.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 3: Replace the old browser IPC implementation**

In `src/main/ipc/system.ts`, import `openAppPasswordInIncognitoChrome`, remove the `shell`-based handler, and register:

```ts
ipcMain.handle(IpcChannels.System.OpenAppPasswordPage, () => {
  return openAppPasswordInIncognitoChrome();
});
```

In `src/preload/index.ts`, change the exposed return type to:

```ts
openAppPasswordPage: (): Promise<{ ok: boolean; error?: string }> =>
  ipcRenderer.invoke(IpcChannels.System.OpenAppPasswordPage),
```

- [ ] **Step 4: Run the focused test again**

Run:

```bash
pnpm test -- src/main/system/chrome-launcher.test.ts
```

Expected: 2 tests pass.

### Task 3: Remove Electron webview infrastructure

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc/system.ts`
- Modify: `src/main/settings.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/shared/constants.ts`

- [ ] **Step 1: Disable webviews at the BrowserWindow boundary**

Remove `webviewTag: true` from `src/main/index.ts`. Remove the `applyWebviewProxy`/`loadSettings` import and startup call.

- [ ] **Step 2: Remove obsolete session and proxy APIs**

Remove `ClearWebviewSession` from `src/shared/ipc-channels.ts`, its preload method, and its handler/imports in `src/main/ipc/system.ts`. Remove proxy application from the settings handler so it only merges and saves settings:

```ts
const merged: AppSettings = { ...current, ...next };
saveSettings(merged);
return merged;
```

Remove `webviewProxy`, `applyWebviewProxy`, `WEBVIEW_PARTITION`, `session`, and `stripScheme` from `src/main/settings.ts`. Remove `webviewProxy` from the preload settings types. Remove `GOOGLE_WEBVIEW_PARTITION` from `src/shared/constants.ts`.

- [ ] **Step 3: Verify the backend surface compiles**

Run:

```bash
pnpm typecheck
```

Expected: renderer errors still point to the obsolete webview UI; main/preload changes introduce no unrelated errors.

### Task 4: Replace the embedded browser with the incognito Chrome action

**Files:**
- Modify: `src/renderer/src/components/accounts/AddAccountDialog.tsx`

- [ ] **Step 1: Remove webview-only imports, state, callbacks, and markup**

Remove `useCallback`, `GOOGLE_WEBVIEW_PARTITION`, `ChevronRight`, `ChevronLeft`, `RotateCw`, `LogOut`, `Settings`, `Globe`, the `WebviewEl`/`WebView` definitions, webview URLs/comments, all webview/proxy/session state, effects and handlers, and the entire right-hand browser/folded-rail JSX.

- [ ] **Step 2: Add launch state and error handling**

Add:

```ts
const [openingChrome, setOpeningChrome] = useState(false);
const [chromeError, setChromeError] = useState<string | null>(null);

const openInBrowser = async (): Promise<void> => {
  setOpeningChrome(true);
  setChromeError(null);
  const result = await window.api.system.openAppPasswordPage();
  setOpeningChrome(false);
  if (!result.ok) setChromeError(result.error ?? '无法打开 Google Chrome');
};
```

- [ ] **Step 3: Convert the dialog to a focused single-column layout**

Use a centered card sized `h-[660px] w-full max-w-[520px]`. Remove the left-column border/fixed width. Above the help disclosure, add:

```tsx
<div className="rounded-lg border border-accent/20 bg-accent-soft/50 p-3">
  <div className="mb-2 flex items-start gap-2">
    <ExternalLink size={16} className="mt-0.5 shrink-0 text-accent" />
    <div>
      <div className="text-[12px] font-medium text-text">在无痕 Chrome 中生成应用密码</div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
        Chrome 关闭后不会保留本次登录。生成 16 位密码后，请回到这里粘贴。
      </p>
    </div>
  </div>
  <button
    type="button"
    onClick={() => void openInBrowser()}
    disabled={openingChrome}
    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-white transition hover:bg-accent/90 active:scale-[0.99] disabled:opacity-50"
  >
    <ExternalLink size={13} />
    {openingChrome ? '正在打开…' : '用无痕 Chrome 打开应用密码页'}
  </button>
  {chromeError && <p className="mt-2 text-[11px] text-danger">{chromeError}</p>}
</div>
```

Update help step 2 to “点击上方按钮，在无痕 Chrome 中登录并生成 16 位应用密码”. Remove the stale post-submit comment about retaining webview login.

- [ ] **Step 4: Run typecheck and tests**

Run:

```bash
pnpm typecheck && pnpm test
```

Expected: typecheck succeeds and 2 tests pass.

### Task 5: Upgrade Electron and verify native dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Pin Electron 42.4.1**

Run:

```bash
pnpm add -D -E electron@42.4.1
```

Expected: `package.json` contains `"electron": "42.4.1"` and the lockfile resolves Electron 42.4.1.

- [ ] **Step 2: Rebuild native modules**

Run:

```bash
pnpm exec electron-rebuild -f -w better-sqlite3,keytar
```

Expected: both native modules rebuild for Electron 42 without error.

- [ ] **Step 3: Run the complete automated verification**

Run:

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: all commands exit 0; Vitest reports 2 passing tests; Electron Vite produces main, preload, and renderer bundles.

### Task 6: Manual smoke test and documentation alignment

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/app_flow.md`

- [ ] **Step 1: Update project guidance**

Replace webview-specific guidance with the approved flow: system Chrome incognito, no UA override, no automation, no persistent Google session, and copy/paste back into the App.

- [ ] **Step 2: Launch and smoke-test**

Run:

```bash
pnpm dev
```

Verify: App opens; Add Account is single-column; clicking the button opens a Chrome window with the incognito indicator at the Google app-password URL; closing Chrome leaves no signed-in session; form parsing and validation remain usable.

- [ ] **Step 3: Run final verification after documentation changes**

Run:

```bash
pnpm typecheck && pnpm test && pnpm build && git diff --check
```

Expected: all commands exit 0 and no whitespace errors are reported.
