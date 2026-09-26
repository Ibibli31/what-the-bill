import CityExplorer from "@/components/CityExplorer";
import Logo from "@/components/Logo";
import styles from "@/modules/page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />

      <section className={styles.card} aria-labelledby="site-title">
        <header className={styles.header}>
          <Logo className={styles.logo} />
          <h1 id="site-title" className={styles.title}>
            What The Bill
          </h1>
          <p className={styles.tagline}>Your city. Your government. In plain English.</p>
        </header>

        <CityExplorer apiKey={process.env.API_KEY} />

        <p className={styles.footer}>
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true">
            <path
              d="M6 13.5s-5-4.4-5-8.1A5 5 0 0 1 11 5.4c0 3.7-5 8.1-5 8.1Z"
              fill="currentColor"
            />
            <circle cx="6" cy="5.4" r="1.8" fill="var(--card)" />
          </svg>
          Built for Ottawa. By the people, for the people.
        </p>
      </section>

      <a className={styles.learnMore} href="#learn-more">
        Learn More
      </a>
    </main>
  );
}
