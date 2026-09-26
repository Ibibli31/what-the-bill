type LogoProps = { className?: string };

export default function Logo({ className }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="What The Bill logo"
    >
      {/* Flag */}
      <path d="M60 18V4" />
      <path d="M60 4h8l-2 3 2 3h-8" />

      {/* Central tower */}
      <path d="M52 36 60 18l8 18" />
      <path d="M53 36h14v52H53z" />
      <circle cx="60" cy="45" r="3.2" />
      <path d="M57.5 88v-9a2.5 2.5 0 0 1 5 0v9" />
      <path d="M57 56v6M63 56v6" />

      {/* Wings */}
      <path d="M53 88H37V66l8-8 8 8" />
      <path d="M67 88h16V66l-8-8-8 8" />
      <path d="M41 72v4M45 72v4M49 72v4M41 80v4M45 80v4M49 80v4" />
      <path d="M71 72v4M75 72v4M79 72v4M71 80v4M75 80v4M79 80v4" />

      {/* Speakers */}
      <path d="M40 50 47 44l3 4-7 6z" />
      <path d="M40 50l-3 3 3 3 3-2" />
      <path d="M80 50 73 44l-3 4 7 6z" />
      <path d="M80 50l3 3-3 3-3-2" />

      {/* Ground */}
      <path d="M30 88h60" />

      {/* Broadcast waves */}
      <path d="M31 56a28 28 0 0 1 8-20" />
      <path d="M24 58a36 36 0 0 1 10-26" />
      <path d="M17 60a44 44 0 0 1 12-32" />
      <path d="M89 56a28 28 0 0 0-8-20" />
      <path d="M96 58a36 36 0 0 0-10-26" />
      <path d="M103 60a44 44 0 0 0-12-32" />
    </svg>
  );
}
