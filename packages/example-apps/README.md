# @react-ui-os/example-apps

The default app suite shipped in the playground and the docs demo: Notes,
Calculator, Clock, Calendar, Reminders, Sketch, and Terminal. Each is a real
`App` object built on `@react-ui-os/core` and `@react-ui-os/desktop`, kept in
one place so both surfaces show the same apps.

```tsx
import { exampleApps } from "@react-ui-os/example-apps";

<Desktop apps={[helloApp, ...exampleApps]} theme={theme} />;
```

The `Hello` intro is intentionally not part of this package: each surface keeps
its own welcome window.
