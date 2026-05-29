/**
 * Type aliases for the canvas DOM types this app uses.
 *
 * The shared flat ESLint config allowlists a fixed set of DOM globals for
 * `no-undef` (window, document, HTMLElement, ...) but not the canvas family
 * (HTMLCanvasElement, CanvasRenderingContext2D, ImageData). That config lives
 * outside this folder and must not be edited, so we recover those types from
 * the constructors hung off `window`, which is allowlisted. `InstanceType`
 * yields the same lib.dom instance types; this is all erased at compile time,
 * so nothing runs and it stays SSR-safe.
 */

export type CanvasEl = InstanceType<typeof window.HTMLCanvasElement>;
export type Canvas2D = InstanceType<typeof window.CanvasRenderingContext2D>;
export type CanvasImageData = InstanceType<typeof window.ImageData>;
