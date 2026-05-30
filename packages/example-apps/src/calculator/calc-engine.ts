// Pure arithmetic core for the basic calculator, modelled on macOS Calculator
// (basic mode). Reference behaviour, sourced not guessed:
//   - Operator chaining evaluates left to right with no precedence: 2 + 3 × 4
//     becomes (2 + 3) × 4 = 20, because pressing an operator commits the
//     pending one against the running value before storing the next.
//   - Repeated "=" repeats the last operation against the running value:
//     after 1 × 2 = (=> 2), each "=" multiplies by 2 again (4, 8, 16, ...).
//     Source: Apple Support, "Use the basic calculator on Mac"
//     https://support.apple.com/guide/calculator/use-the-basic-calculator-calc2c05fe23/mac
//   - "%" divides the current entry by 100 (standard-calculator percent).
//   - "+/-" negates the current entry.
//   - "AC" clears everything; once a digit is entered it becomes "C" which
//     clears the current entry only.
//     Source: Apple Support, "Keyboard shortcuts for Calculator on Mac"
//     https://support.apple.com/guide/calculator/keyboard-shortcuts-calce87b2f66/mac

export type Operator = "add" | "subtract" | "multiply" | "divide";

export interface CalcState {
  /** The string the user is currently typing or the formatted result. */
  display: string;
  /** Running accumulator the pending operator will apply against. */
  accumulator: number | null;
  /** Operator awaiting its second operand, if any. */
  pendingOperator: Operator | null;
  /**
   * The operator + right-hand operand to repeat when "=" is pressed again
   * without entering a new operator. Set after every "=".
   */
  repeat: { operator: Operator; operand: number } | null;
  /**
   * True while the display still holds a committed result (after "=" or an
   * operator press). The next digit starts a fresh entry rather than appending.
   */
  overwrite: boolean;
  /** False until at least one digit/decimal has been entered: drives AC vs C. */
  entered: boolean;
}

export const initialCalcState: CalcState = {
  display: "0",
  accumulator: null,
  pendingOperator: null,
  repeat: null,
  overwrite: true,
  entered: false,
};

function apply(a: number, b: number, op: Operator): number {
  switch (op) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      // macOS shows "Not a number" on divide by zero; Infinity is formatted
      // to that string downstream, so no guard is needed here.
      return a / b;
  }
}

function currentValue(state: CalcState): number {
  const n = Number(state.display);
  return Number.isFinite(n) ? n : 0;
}

export function inputDigit(state: CalcState, digit: string): CalcState {
  if (state.overwrite) {
    return {
      ...state,
      display: digit,
      overwrite: false,
      entered: true,
    };
  }
  // Avoid stacking leading zeros ("00") but allow "0." to grow.
  const next = state.display === "0" ? digit : state.display + digit;
  return { ...state, display: next, entered: true };
}

export function inputDecimal(state: CalcState): CalcState {
  if (state.overwrite) {
    return { ...state, display: "0.", overwrite: false, entered: true };
  }
  if (state.display.includes(".")) return { ...state, entered: true };
  return { ...state, display: state.display + ".", entered: true };
}

export function chooseOperator(state: CalcState, operator: Operator): CalcState {
  const value = currentValue(state);

  // Chaining an operator right after another operator just swaps it; nothing
  // is committed because no new operand was typed.
  if (state.pendingOperator !== null && state.overwrite) {
    return { ...state, pendingOperator: operator };
  }

  let accumulator: number;
  if (state.accumulator === null) {
    accumulator = value;
  } else if (state.pendingOperator !== null) {
    accumulator = apply(state.accumulator, value, state.pendingOperator);
  } else {
    accumulator = value;
  }

  return {
    ...state,
    display: formatNumber(accumulator),
    accumulator,
    pendingOperator: operator,
    repeat: null,
    overwrite: true,
    entered: true,
  };
}

export function equals(state: CalcState): CalcState {
  // Pressing "=" again with no pending operator repeats the last op/operand.
  if (state.pendingOperator === null) {
    if (state.repeat === null) return state;
    const result = apply(currentValue(state), state.repeat.operand, state.repeat.operator);
    return {
      ...state,
      display: formatNumber(result),
      accumulator: result,
      overwrite: true,
      entered: true,
    };
  }

  const operand = currentValue(state);
  const left = state.accumulator ?? operand;
  const result = apply(left, operand, state.pendingOperator);
  return {
    ...state,
    display: formatNumber(result),
    accumulator: result,
    pendingOperator: null,
    repeat: { operator: state.pendingOperator, operand },
    overwrite: true,
    entered: true,
  };
}

export function negate(state: CalcState): CalcState {
  if (state.display === "0") return state;
  const value = currentValue(state) * -1;
  return { ...state, display: formatNumber(value) };
}

export function percent(state: CalcState): CalcState {
  const value = currentValue(state) / 100;
  return { ...state, display: formatNumber(value), entered: true };
}

/** AC: wipe everything. */
export function clearAll(): CalcState {
  return initialCalcState;
}

/** C: clear the current entry only, keeping any pending operator/accumulator. */
export function clearEntry(state: CalcState): CalcState {
  return { ...state, display: "0", overwrite: true, entered: false };
}

/** Delete (backspace): drop the last typed character of the current entry. */
export function deleteLast(state: CalcState): CalcState {
  if (state.overwrite || state.display === "0") return state;
  const trimmed = state.display.slice(0, -1);
  const next = trimmed === "" || trimmed === "-" ? "0" : trimmed;
  return { ...state, display: next, entered: next !== "0" };
}

const PLAIN = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, useGrouping: false });
const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, useGrouping: true });

/**
 * Convert a number into the canonical internal display string. Keeps a "raw"
 * form (no grouping) so the value can be re-parsed losslessly. Thousands
 * grouping for presentation is applied separately by `formatForDisplay`.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "Not a number";
  if (value === 0) return "0";

  const abs = Math.abs(value);
  // Fall back to exponential for magnitudes a fixed display cannot hold.
  if (abs >= 1e15 || (abs < 1e-6 && abs > 0)) {
    return value.toExponential(6).replace(/\.?0+e/, "e");
  }

  // Round to a sensible number of significant digits to avoid float dust
  // (0.1 + 0.2 = 0.30000000000000004). 12 digits matches the macOS basic
  // display width while staying clear of representation noise.
  const rounded = Number(value.toPrecision(12));
  let out = String(rounded);
  if (out.includes("e")) {
    out = rounded.toExponential(6).replace(/\.?0+e/, "e");
  }
  return out;
}

/**
 * Presentation formatter for the on-screen display: groups the integer part
 * with thousands separators while preserving the typed decimal portion
 * (including a trailing "." mid-entry).
 */
export function formatForDisplay(raw: string): string {
  if (raw === "Not a number" || raw.includes("e")) return raw;

  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [intPart = "0", ...rest] = body.split(".");
  const hasDot = body.includes(".");
  const decPart = rest.join("");

  const intNum = Number(intPart);
  const groupedInt = Number.isFinite(intNum) ? GROUPED.format(intNum) : PLAIN.format(0);

  let result = groupedInt;
  if (hasDot) result += "." + decPart;
  return negative ? "-" + result : result;
}
