// Restored after APFS sparse-file corruption
export function BrandShield({ size = 48 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        flexShrink: 0,
        overflow: 'visible',
        paddingBottom: Math.max(2, Math.round(size * 0.06)),
      }}
    >
      <svg
        width={Math.round(size * 0.84)}
        height={Math.round(size * 0.84)}
        viewBox="0 0 120 128"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <path d="M24 12H96L110 34V78L60 114L10 78V34L24 12Z" fill="#050D1E" />
        <path d="M28 18H92L102 36V75L60 107L18 75V36L28 18Z" fill="#D4FF3E" />
        <path d="M34 24H86L94 40V72L60 98L26 72V40L34 24Z" fill="#A8CF0A" />
        <rect x="33" y="35" width="54" height="14" rx="3" fill="#050D1E" />
        <rect x="52" y="49" width="16" height="28" rx="2.5" fill="#050D1E" />
      </svg>
    </span>
  )
}

export default BrandShield