# @react-ui-os/core

Pure logic and types for react-ui-os. The window manager, the storage
contract, the settings overlay, and the notification store live here; the
components that render them live in `@react-ui-os/desktop`. This package never
imports the desktop, and themes depend on it for types only.

## Entry points

| Import                             | Contents                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `@react-ui-os/core`                | everything below, plus `App`, `OsTheme`, and the customizable field types |
| `@react-ui-os/core/window-manager` | `WindowManagerProvider`, `useWindowManager`, reducer, `windowIdOf`        |
| `@react-ui-os/core/storage`        | `StorageAdapter`, `createLocalStorageAdapter`                             |
| `@react-ui-os/core/settings`       | `applyPrefs`, `applyAppearance`, `getPath`, `setPath`                     |
| `@react-ui-os/core/notifications`  | `notify`, `useNotifications`, the notification store                      |

The root, `window-manager`, and `notifications` bundles carry a `"use client"`
directive (they contain hooks and context). `storage` and `settings` are plain
logic and import cleanly from server code.

## Usage

```ts
import { notify } from "@react-ui-os/core";

notify({ appId: "mail", title: "Inbox", body: "3 new messages" });
```

`<Desktop>` mounts the renderer; any code anywhere calls the imperative
function. The same shape (module store, imperative call, renderer in the
desktop package) carries the context menu, HUD, snap preview, and status tray.

## Install

```bash
pnpm add @react-ui-os/core @react-ui-os/desktop @react-ui-os/theme-macos
```

`@react-ui-os/desktop` declares this package as a peer dependency so exactly
one copy is installed: the window manager context and the module-level stores
are singletons, and a duplicated copy would split them.
