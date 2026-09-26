import Backdrop from "@/components/Backdrop";
import CityExplorer from "@/components/CityExplorer";
import Logo from "@/components/Logo";
import styles from "@/modules/page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <Backdrop />

      <section className={styles.card} aria-labelledby="site-title">
        {/* Terminal-style window bar */}
        <div className={styles.titlebar} aria-hidden="true">
          <span className={styles.lights}>
            <i className={styles.lightRed} />
            <i className={styles.lightWhite} />
            <i className={styles.lightRed} />
          </span>
          <span className={styles.windowTitle}>whatthebill.ca — ward lookup</span>
        </div>

        <header className={styles.header}>
          <Logo className={styles.logo} />
          <h1 id="site-title" className={styles.title}>
            What The Bill
          </h1>
          <p className={styles.tagline}>Your city. Your government. In plain English.</p>
        </header>

        <CityExplorer apiKey={process.env.API_KEY} />

        <p className={styles.footer}>
          <span>Status: ready</span>
          <span>Ottawa · v0.1</span>
        </p>
      </section>

      {/* TODO: point this at the real About page once it exists. */}
      <a className={styles.learnMore} href="#learn-more">
        [ Learn more ]
      </a>
    </main>
  );
}