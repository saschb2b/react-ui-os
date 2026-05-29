/**
 * Time-formatting helpers shared by the three Clock tabs. Pure functions,
 * no DOM, so they are SSR-safe and unit-testable in isolation.
 */

/** Zero-pad an integer to a fixed width. */
function pad(value: number, width = 2): string {
  return String(Math.floor(value)).padStart(width, "0");
}

/**
 * Format an elapsed millisecond count as the iOS stopwatch does:
 * mm:ss.cc with centiseconds, promoting to hh:mm:ss.cc past one hour.
 * iOS shows two centisecond digits, not milliseconds.
 */
export function formatStopwatch(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSeconds = Math.floor(totalCs / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
}

/**
 * Format a remaining millisecond count for the timer countdown as iOS does:
 * h:mm:ss when there is an hour component, otherwise m:ss. The leading
 * unit is unpadded (iOS shows "1:09", not "01:09").
 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) {
    return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${String(minutes)}:${pad(seconds)}`;
}
