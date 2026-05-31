"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import type { AppContentProps } from "@react-ui-os/core";
import { useWindowManager } from "@react-ui-os/core";
import { useApp, useApps, useTheme } from "@react-ui-os/desktop";
import {
  commandNames,
  completeCommand,
  runCommand,
  type CommandContext,
  type ShellEnv,
} from "./shell";

/** Monospace stack matching the platform terminal fonts (SF Mono, Menlo, …). */
const MONO =
  '"SF Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const USER = "guest";
const CWD = "~";

/** One scrollback line: an echoed command (with prompt) or an output line. */
interface ScrollLine {
  id: number;
  kind: "command" | "output";
  text: string;
}

const PROMPT_GLYPH = "❯"; // zsh-style chevron prompt

export function TerminalContent({ focused }: AppContentProps) {
  const theme = useTheme();
  // The prompt symbol and the input caret carry the app's identity color,
  // read from the registry rather than the global accent, matching the
  // sibling apps. This is the only accented affordance in the surface.
  const accent = useApp("terminal")?.accent ?? theme.palette.accent;
  const apps = useApps();
  const { openWindow } = useWindowManager();

  const [lines, setLines] = useState<ScrollLine[]>(() => bootLines());
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  // -1 means "editing a fresh line"; otherwise an index into `history`.
  const [historyCursor, setHistoryCursor] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineId = useRef(lines.length);

  const openableAppIds = useMemo(() => apps.map((a) => a.id), [apps]);
  const appLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const a of apps) labels[a.id] = a.name;
    return labels;
  }, [apps]);

  const appendLines = useCallback((incoming: Omit<ScrollLine, "id">[]) => {
    setLines((prev) => {
      const next = incoming.map((l) => ({ ...l, id: lineId.current++ }));
      return [...prev, ...next];
    });
  }, []);

  const submit = useCallback(
    (raw: string) => {
      const promptPrefix = `${USER}@react-ui-os ${CWD} ${PROMPT_GLYPH} `;
      // Always echo the entered line with its prompt, even when empty, so the
      // scrollback reads like a real session.
      appendLines([{ kind: "command", text: `${promptPrefix}${raw}` }]);

      const trimmed = raw.trim();
      const nextHistory = trimmed === "" ? history : [...history, trimmed];
      if (trimmed !== "") setHistory(nextHistory);
      setHistoryCursor(-1);
      setInput("");

      const env: ShellEnv = { cwd: CWD, user: USER, history: nextHistory };
      const ctx: CommandContext = { env, openableAppIds, appLabels };
      const result = runCommand(raw, ctx);

      if (result.signal.type === "clear") {
        setLines([]);
        lineId.current = 0;
        return;
      }
      if (result.signal.type === "open") {
        openWindow({ kind: "app", appId: result.signal.appId });
      }
      if (result.output.length > 0) {
        appendLines(result.output.map((text) => ({ kind: "output", text })));
      }
    },
    [appendLines, appLabels, history, openableAppIds, openWindow],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit(input);
        return;
      }
      // Readline-style history recall. ArrowUp walks toward older entries,
      // ArrowDown back toward the fresh line. Matches bash/zsh behavior.
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (history.length === 0) return;
        const next =
          historyCursor === -1 ? history.length - 1 : Math.max(0, historyCursor - 1);
        setHistoryCursor(next);
        setInput(history[next] ?? "");
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (historyCursor === -1) return;
        const next = historyCursor + 1;
        if (next >= history.length) {
          setHistoryCursor(-1);
          setInput("");
        } else {
          setHistoryCursor(next);
          setInput(history[next] ?? "");
        }
        return;
      }
      // Tab completion for the first word (command name). On a single match it
      // completes; on several it lists them, like a shell double-Tab.
      if (event.key === "Tab") {
        event.preventDefault();
        if (input.includes(" ")) return;
        const matches = completeCommand(input);
        if (matches.length === 1) {
          setInput(matches[0] ?? input);
        } else if (matches.length > 1) {
          appendLines([{ kind: "output", text: matches.join("  ") }]);
        }
        return;
      }
    },
    [appendLines, history, historyCursor, input, submit],
  );

  // Auto-scroll to the bottom whenever new output lands.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Pull focus to the input when the window gains focus.
  useEffect(() => {
    if (focused) inputRef.current?.focus();
  }, [focused]);

  const focusInput = useCallback(() => {
    // Don't steal focus while the user is selecting text to copy.
    if (typeof window !== "undefined") {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;
    }
    inputRef.current?.focus();
  }, []);

  // The terminal surface is intentionally darker than the window chrome, as
  // real terminals are. Derived from palette.background (a token) rather than a
  // raw hex, so themes keep control of the canvas color.
  const surfaceStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    background: theme.palette.background,
    color: theme.palette.textPrimary,
    borderRadius: theme.shape.small,
    border: `1px solid ${focused ? accent : theme.palette.border}`,
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 1.5,
    overflow: "hidden",
    transition: `border-color ${theme.motion.dockHoverDurationMs}ms ${theme.motion.windowOpenEasing}`,
  };

  const scrollStyle: CSSProperties = {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    padding: "10px 12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  const inputRowStyle: CSSProperties = {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderTop: `1px solid ${theme.palette.border}`,
  };

  const inputStyle: CSSProperties = {
    flex: "1 1 auto",
    appearance: "none",
    border: "none",
    outline: "none",
    background: "transparent",
    color: theme.palette.textPrimary,
    caretColor: accent,
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 1.5,
    minWidth: 0,
  };

  return (
    <div style={surfaceStyle} onMouseDown={focusInput}>
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
        style={scrollStyle}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            style={{
              color:
                line.kind === "command"
                  ? theme.palette.textPrimary
                  : theme.palette.textSecondary,
            }}
          >
            {line.text}
          </div>
        ))}
      </div>
      <div style={inputRowStyle}>
        <span aria-hidden style={{ color: accent, fontWeight: 600 }}>
          {PROMPT_GLYPH}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Terminal command input"
          placeholder="type help"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={inputStyle}
        />
      </div>
    </div>
  );
}

/** Seed scrollback shown on first mount. */
function bootLines(): ScrollLine[] {
  const texts = [
    "react-ui-os terminal",
    `Type help for a list of commands. Try: ${commandNames().slice(0, 4).join(", ")}.`,
  ];
  return texts.map((text, id) => ({ id, kind: "output", text }));
}
