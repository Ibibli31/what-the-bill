import styles from "@/modules/Logo.module.css";

type LogoProps = { className?: string };

/** Line drawing of Parliament's Centre Block: the Peace Tower, the main block and corner towers. */
export default function Logo({ className }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 124"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="What The Bill logo: the Parliament of Canada"
    >
      {/* Flagpole and a waving red-white-red flag */}
      <path d="M80 16V2" />
      <g className={styles.flag}>
        <rect x="80.5" y="2" width="4" height="8" fill="var(--red)" stroke="none" />
        <rect x="84.5" y="2" width="6" height="8" fill="#ffffff" stroke="none" />
        <rect x="90.5" y="2" width="4" height="8" fill="var(--red)" stroke="none" />
      </g>

      {/* Peace Tower */}
      <path d="M74 38 80 16l6 22" />
      <path d="M72.5 38h15v4h-15z" />
      <path d="M72 38l1.2-7 1.2 7M85.6 38l1.2-7 1.2 7" />
      <path d="M74 42v74M86 42v74" />
      <circle cx="80" cy="51" r="3.6" />
      <path d="M80 51v-2M80 51h1.8" />
      <path d="M77.5 60v9M82.5 60v9M77.5 74v8M82.5 74v8" />
      <path d="M76.5 116v-7a3.5 3.5 0 0 1 7 0v7" />

      {/* Centre Block */}
      <path d="M36 84l6-7h32M86 77h32l6 7" />
      <path d="M36 84h38M86 84h38" />
      <path d="M36 84v32M124 84v32" />
      <path d="M48 77l1.5-6 1.5 6M59 77l1.5-6 1.5 6M99 77l1.5-6 1.5 6M110 77l1.5-6 1.5 6" />
      <path d="M42 91v7M48 91v7M54 91v7M60 91v7M66 91v7M94 91v7M100 91v7M106 91v7M112 91v7M118 91v7" />
      <path d="M42 104v7M48 104v7M54 104v7M60 104v7M66 104v7M94 104v7M100 104v7M106 104v7M112 104v7M118 104v7" />

      {/* Corner towers */}
      <path d="M26 116V72h10v44M124 116V72h10v44" />
      <path d="M25 72l6-16 6 16M123 72l6-16 6 16" />
      <path d="M31 56v-5M129 56v-5" />

      {/* Ground */}
      <path d="M16 116h128" />
    </svg>
  );
}