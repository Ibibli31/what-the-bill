import Backdrop from "@/components/Backdrop";
import CityExplorer from "@/components/CityExplorer";
import LearnMore from "@/components/LearnMore";
import Logo from "@/components/Logo";
import type { Bill } from "@/lib/bill";
import { getBills } from "@/services/bills";
import styles from "@/modules/page.module.css";

async function loadBills(): Promise<Bill[] | null> {
  try {
    return await getBills();
  } catch (error) {
    console.error("Loading bills from Supabase failed:", error);
    return null;
  }
}

export default async function HomePage() {
  const bills = await loadBills();

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

        <CityExplorer apiKey={process.env.API_KEY} bills={bills} />

        <p className={styles.footer}>
          <span>Status: ready</span>
          <span>Ottawa · v0.1</span>
        </p>
      </section>

      <LearnMore />
    </main>
  );
}