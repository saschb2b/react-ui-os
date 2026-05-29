/**
 * Default folder icon for desktop shortcuts. Frosted tab + body with a soft
 * gradient. Sized to look right inside a 48-64 px tile.
 */
export function FolderSvg({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
    >
      <defs>
        <linearGradient id="rui-folder-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3c4658" />
          <stop offset="100%" stopColor="#1c2333" />
        </linearGradient>
        <linearGradient id="rui-folder-tab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a5573" />
          <stop offset="100%" stopColor="#2c364e" />
        </linearGradient>
      </defs>
      <path
        d="M 6 12 L 18 12 L 22 16 L 42 16 L 42 19 L 6 19 Z"
        fill="url(#rui-folder-tab)"
      />
      <rect
        x="6"
        y="18"
        width="36"
        height="22"
        rx="2.5"
        ry="2.5"
        fill="url(#rui-folder-body)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.5"
      />
      <path d="M 7 19 L 41 19" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
    </svg>
  );
}
