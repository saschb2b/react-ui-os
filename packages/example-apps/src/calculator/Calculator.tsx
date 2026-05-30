"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { AppContentProps } from "@react-ui-os/core";
import { useApp, useTheme } from "@react-ui-os/desktop";
import {
  chooseOperator,
  clearAll,
  clearEntry,
  deleteLast,
  equals,
  formatForDisplay,
  inputDecimal,
  inputDigit,
  initialCalcState,
  negate,
  percent,
  type CalcState,
  type Operator,
} from "./calc-engine";

type Action =
  | { type: "digit"; digit: string }
  | { type: "decimal" }
  | { type: "operator"; operator: Operator }
  | { type: "equals" }
  | { type: "negate" }
  | { type: "percent" }
  | { type: "clear" }
  | { type: "delete" };

function reducer(state: CalcState, action: Action): CalcState {
  switch (action.type) {
    case "digit":
      return inputDigit(state, action.digit);
    case "decimal":
      return inputDecimal(state);
    case "operator":
      return chooseOperator(state, action.operator);
    case "equals":
      return equals(state);
    case "negate":
      return negate(state);
    case "percent":
      return percent(state);
    case "clear":
      // AC clears everything; once a digit is entered the key is C, which
      // clears the current entry only. macOS basic-mode behaviour.
      return state.entered ? clearEntry(state) : clearAll();
    case "delete":
      return deleteLast(state);
  }
}

const OPERATOR_GLYPH: Record<Operator, string> = {
  divide: "÷",
  multiply: "×",
  subtract: "−",
  add: "+",
};

const OPERATOR_LABEL: Record<Operator, string> = {
  divide: "divide",
  multiply: "multiply",
  subtract: "subtract",
  add: "add",
};

export function CalculatorContent({ focused }: AppContentProps) {
  const theme = useTheme();
  // The operator column is tinted with the app's own accent (its identity
  // color), read from the registry rather than the global theme accent, so
  // the in-window affordance matches the green dock tile. macOS Calculator
  // likewise uses the app's identity color (orange) for the operator column.
  const accent = useApp("calculator")?.accent ?? theme.palette.accent;
  const [state, dispatch] = useReducer(reducer, initialCalcState);
  // Display font shrinks instead of overflowing the window on long numbers.
  const displayRef = useRef<HTMLDivElement>(null);
  const [displayScale, setDisplayScale] = useState(1);

  const formatted = formatForDisplay(state.display);
  const clearLabel = state.entered ? "C" : "AC";
  const activeOperator = state.pendingOperator;

  // The currently active operator is highlighted only while the running value
  // is committed (before the next operand is typed), matching macOS, where the
  // operator key inverts until you start the second number.
  const highlightedOperator = activeOperator !== null && state.overwrite ? activeOperator : null;

  useEffect(() => {
    const el = displayRef.current;
    if (typeof window === "undefined" || el === null) return;
    const parent = el.parentElement;
    if (parent === null) return;
    // Reset to natural size, then scale down if it overflows the row width.
    el.style.transform = "scale(1)";
    const available = parent.clientWidth;
    const needed = el.scrollWidth;
    const next = needed > available && needed > 0 ? Math.max(0.5, available / needed) : 1;
    setDisplayScale(next);
  }, [formatted]);

  // Physical keyboard, only while this window is focused. Key map mirrors the
  // macOS Calculator shortcuts: + - * / for operators, Enter or "=" for
  // equals, Esc or "c" for clear, Delete/Backspace to drop a digit, "%" for
  // percent, and Option-Minus for negate (we also accept "n" / "_").
  // Source: https://support.apple.com/guide/calculator/keyboard-shortcuts-calce87b2f66/mac
  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      const { key } = event;
      if (key >= "0" && key <= "9") {
        dispatch({ type: "digit", digit: key });
      } else if (key === "." || key === ",") {
        dispatch({ type: "decimal" });
      } else if (key === "+") {
        dispatch({ type: "operator", operator: "add" });
      } else if (key === "-") {
        if (event.altKey) dispatch({ type: "negate" });
        else dispatch({ type: "operator", operator: "subtract" });
      } else if (key === "*") {
        dispatch({ type: "operator", operator: "multiply" });
      } else if (key === "/") {
        event.preventDefault(); // browser quick-find
        dispatch({ type: "operator", operator: "divide" });
      } else if (key === "=" || key === "Enter") {
        event.preventDefault();
        dispatch({ type: "equals" });
      } else if (key === "%") {
        dispatch({ type: "percent" });
      } else if (key === "Escape" || key === "c" || key === "C") {
        dispatch({ type: "clear" });
      } else if (key === "Backspace" || key === "Delete") {
        dispatch({ type: "delete" });
      } else if (key === "n" || key === "_") {
        dispatch({ type: "negate" });
      } else {
        return;
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!focused || typeof window === "undefined") return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focused, handleKey]);

  const surfaceStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    gap: 12,
    color: theme.palette.textPrimary,
    userSelect: "none",
  };

  const displayRowStyle: CSSProperties = {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    minHeight: 64,
    padding: "0 6px",
    overflow: "hidden",
  };

  const displayStyle: CSSProperties = {
    fontSize: 52,
    lineHeight: 1.1,
    fontWeight: 300,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    transform: `scale(${displayScale})`,
    transformOrigin: "right center",
    color: theme.palette.textPrimary,
  };

  const gridStyle: CSSProperties = {
    flex: "1 1 auto",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gridAutoRows: "1fr",
    gap: 8,
    minHeight: 0,
  };

  return (
    <div style={surfaceStyle}>
      <div style={displayRowStyle}>
        <div
          ref={displayRef}
          role="status"
          aria-live="polite"
          aria-label={`Result ${formatted}`}
          style={displayStyle}
        >
          {formatted}
        </div>
      </div>

      <div style={gridStyle} role="group" aria-label="Calculator keypad">
        <FunctionKey
          label={clearLabel}
          ariaLabel={state.entered ? "clear entry" : "all clear"}
          onClick={() => dispatch({ type: "clear" })}
        />
        <FunctionKey label="+/−" ariaLabel="negate" onClick={() => dispatch({ type: "negate" })} />
        <FunctionKey label="%" ariaLabel="percent" onClick={() => dispatch({ type: "percent" })} />
        <OperatorKey operator="divide" active={highlightedOperator === "divide"} dispatch={dispatch} />

        <DigitKey digit="7" dispatch={dispatch} />
        <DigitKey digit="8" dispatch={dispatch} />
        <DigitKey digit="9" dispatch={dispatch} />
        <OperatorKey operator="multiply" active={highlightedOperator === "multiply"} dispatch={dispatch} />

        <DigitKey digit="4" dispatch={dispatch} />
        <DigitKey digit="5" dispatch={dispatch} />
        <DigitKey digit="6" dispatch={dispatch} />
        <OperatorKey operator="subtract" active={highlightedOperator === "subtract"} dispatch={dispatch} />

        <DigitKey digit="1" dispatch={dispatch} />
        <DigitKey digit="2" dispatch={dispatch} />
        <DigitKey digit="3" dispatch={dispatch} />
        <OperatorKey operator="add" active={highlightedOperator === "add"} dispatch={dispatch} />

        <DigitKey digit="0" wide dispatch={dispatch} />
        <DigitKey digit="." ariaLabel="decimal point" dispatch={dispatch} />
        <button
          type="button"
          aria-label="equals"
          onClick={() => dispatch({ type: "equals" })}
          style={keyStyle(theme, "operator", false, accent)}
        >
          =
        </button>
      </div>
    </div>
  );
}

type KeyVariant = "digit" | "function" | "operator";

function keyStyle(
  theme: ReturnType<typeof useTheme>,
  variant: KeyVariant,
  active: boolean,
  accent: string = theme.palette.accent,
): CSSProperties {
  const base: CSSProperties = {
    appearance: "none",
    border: `1px solid ${theme.palette.border}`,
    borderRadius: theme.shape.small,
    fontFamily: "inherit",
    fontSize: 20,
    fontWeight: 400,
    cursor: "pointer",
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: `background ${theme.motion.dockHoverDurationMs}ms ${theme.motion.windowOpenEasing}, color ${theme.motion.dockHoverDurationMs}ms ${theme.motion.windowOpenEasing}`,
  };

  if (variant === "operator") {
    // macOS basic mode: the operator column is the accent color, and the
    // active operator inverts (accent fill flips to an accent-on-surface
    // highlight). This is the sanctioned accent affordance, matching the
    // reference, not decoration.
    return {
      ...base,
      fontSize: 24,
      color: active ? accent : theme.palette.textPrimary,
      background: active ? theme.palette.surface : accent,
      borderColor: accent,
    };
  }

  if (variant === "function") {
    return {
      ...base,
      color: theme.palette.textSecondary,
      background: "transparent",
    };
  }

  return {
    ...base,
    color: theme.palette.textPrimary,
    background: "transparent",
  };
}

function DigitKey({
  digit,
  wide = false,
  ariaLabel,
  dispatch,
}: {
  digit: string;
  wide?: boolean;
  ariaLabel?: string;
  dispatch: (action: Action) => void;
}) {
  const theme = useTheme();
  const onClick = () =>
    digit === "." ? dispatch({ type: "decimal" }) : dispatch({ type: "digit", digit });
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? digit}
      onClick={onClick}
      style={{
        ...keyStyle(theme, "digit", false),
        ...(wide ? { gridColumn: "span 2", justifyContent: "flex-start", paddingLeft: 22 } : null),
      }}
    >
      {digit}
    </button>
  );
}

function OperatorKey({
  operator,
  active,
  dispatch,
}: {
  operator: Operator;
  active: boolean;
  dispatch: (action: Action) => void;
}) {
  const theme = useTheme();
  const accent = useApp("calculator")?.accent ?? theme.palette.accent;
  return (
    <button
      type="button"
      aria-label={OPERATOR_LABEL[operator]}
      aria-pressed={active}
      onClick={() => dispatch({ type: "operator", operator })}
      style={keyStyle(theme, "operator", active, accent)}
    >
      {OPERATOR_GLYPH[operator]}
    </button>
  );
}

function FunctionKey({
  label,
  ariaLabel,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  const theme = useTheme();
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} style={keyStyle(theme, "function", false)}>
      {label}
    </button>
  );
}
