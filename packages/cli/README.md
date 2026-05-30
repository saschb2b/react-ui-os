# @react-ui-os/cli

Installs react-ui-os apps into your project. Apps are not bundled into the
library; you copy the ones you want into your own codebase, so you own the
files and can edit them after install.

```bash
npx @react-ui-os/cli list
npx @react-ui-os/cli add notes
```

`add` copies an app's files into `src/os-apps/<id>/` (or `os-apps/<id>/` when
the project has no `src` directory; override with `--dir`), then prints the npm
dependencies to install and how to register the app with `<Desktop>`.

The CLI ships its apps inlined, so it runs with no network and no extra config.
The app list is the repo-root `registry.json`; `pnpm --filter @react-ui-os/cli build`
bundles the sources from it.
