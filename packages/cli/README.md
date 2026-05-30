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

The built-in apps are inlined into the CLI, so it runs with no network and no
config. The app list is the repo-root `registry.json`.

## Your own registry

Install from any registry, not just the built-in one:

```bash
# build a self-contained registry from your registry.json and host it
npx @react-ui-os/cli build registry.json --out public/registry.json

# anyone installs from the hosted file
npx @react-ui-os/cli add weather --registry https://you.example/registry.json
npx @react-ui-os/cli list --registry https://you.example/registry.json
```

A local `registry.json` works with `--registry ./registry.json` directly (it
reads sources from each entry's `dir`). Remote registries must be the built,
inlined form, since the CLI cannot read your repository over HTTP.
