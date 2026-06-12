# @react-ui-os/cli

Installs react-ui-os apps into your project. Apps are not bundled into the
library; you copy the ones you want into your own codebase, so you own the
files and can edit them after install.

```bash
npx @react-ui-os/cli list
npx @react-ui-os/cli info notes
npx @react-ui-os/cli add notes
```

`add` copies an app's files into `src/os-apps/<id>/` (or `os-apps/<id>/` when
the project has no `src` directory; override with `--dir`), then prints the
install command for the missing dependencies (matched to your package manager)
and a ready-to-paste register snippet. `info` shows an app's description,
dependencies, and files with sizes before you copy anything.

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

File names in a registry may nest into subdirectories
(`"files": ["index.tsx", "components/Panel.tsx"]`). Paths that would escape
the install directory (absolute, drive-rooted, or containing `..`) are
rejected, so a hostile registry cannot write outside `os-apps/<id>/`.
