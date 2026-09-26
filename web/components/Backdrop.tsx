import styles from "@/modules/Backdrop.module.css";

// Flat cloud shape, drawn once and reused at different sizes and speeds.
function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 220 70" aria-hidden="true">
      <path
        d="M20 60h180a18 18 0 0 0 0-36 28 28 0 0 0-50-14 34 34 0 0 0-62 6 22 22 0 0 0-38 10 17 17 0 0 0-30 34z"
        fill="#ffffff"
      />
    </svg>
  );
}

/** The skyline image, with slow-moving clouds and light shimmering on the river. */
export default function Backdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.image} />
      <Cloud className={`${styles.cloud} ${styles.cloudA}`} />
      <Cloud className={`${styles.cloud} ${styles.cloudB}`} />
      <Cloud className={`${styles.cloud} ${styles.cloudC}`} />
      <Cloud className={`${styles.cloud} ${styles.cloudD}`} />
      <div className={styles.shimmer} />
      <div className={styles.scrim} />
    </div>
  );
}