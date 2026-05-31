import { useTheme } from "@react-ui-os/desktop";

export type ThemeChoice = "default" | "mintables" | "saas" | "redmond" | "ubuntu";

// Friendly labels. The three OS clones read as their platform so a visitor
// recognizes them at a glance; Mintables and SaaS keep their library names.
const CHOICES: { id: ThemeChoice; label: string }[] = [
  { id: "default", label: "macOS" },
  { id: "mintables", label: "Mintables" },
  { id: "saas", label: "SaaS" },
  { id: "redmond", label: "Windows" },
  { id: "ubuntu", label: "Ubuntu" },
];

interface Props {
  value: ThemeChoice;
  onChange: (choice: ThemeChoice) => void;
}

/**
 * On-canvas theme switcher for the playground. A segmented control pinned
 * just below the menu-bar line at top-center, the one strip free of dock,
 * menu bar, and status cluster across all five themes. Lets a visitor swap
 * the whole look with a click instead of editing the `?theme=` query param.
 *
 * Rendered as a `<Desktop>` child so it reads live theme tokens via
 * `useTheme()` and reskins itself on every switch. It hides inside a feature
 * `?demo=` embed (a component doc page pointing at one surface) so those
 * focused previews stay uncluttered.
 */
export function ThemeSwitcher({ value, onChange }: Props) {
  const theme = useTheme();

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo")) return null;
  }

  return (
    <div
      role="group"
      aria-label="Desktop theme"
      style={{
        position: "fixed",
        top: 40,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Wrap to a second row instead of clipping on a narrow embed or phone.
        flexWrap: "wrap",
        maxWidth: "calc(100vw - 16px)",
        gap: 2,
        padding: 3,
        // Concentric with the inner buttons: outer radius = inner + padding.
        borderRadius: theme.shape.small + 3,
        background: theme.palette.surface,
        border: `1px solid ${theme.palette.border}`,
        backdropFilter: theme.blur.surface,
        WebkitBackdropFilter: theme.blur.surface,
        color: theme.palette.textPrimary,
        fontFamily: "inherit",
        boxShadow: theme.elevation?.windowUnfocused,
      }}
    >
      {CHOICES.map((choice) => {
        const active = choice.id === value;
        return (
          <button
            key={choice.id}
            type="button"
            onClick={() => onChange(choice.id)}
            aria-pressed={active}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              lineHeight: 1,
              padding: "6px 12px",
              borderRadius: theme.shape.small,
              background: active ? theme.palette.accent : "transparent",
              color: active ? "#fff" : theme.palette.textSecondary,
              transition: `background ${theme.motion.dockHoverDurationMs}ms ease, color ${theme.motion.dockHoverDurationMs}ms ease`,
            }}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
