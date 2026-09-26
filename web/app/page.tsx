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
        {/* The map sits across the top of the card, then the header, then the search. */}
        <CityExplorer bills={bills}>
          <header className={styles.header}>
            <span className={styles.badge}>
              <Logo className={styles.logo} />
            </span>
            <h1 id="site-title" className={styles.title}>
              What The Bill
            </h1>
            <p className={styles.tagline}>Your city. Your government. In plain English.</p>
          </header>
        </CityExplorer>

        <p className={styles.footer}>
          <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
            <path
              d="M8 0a8 8 0 0 0-8 8c0 5.6 8 12 8 12s8-6.4 8-12a8 8 0 0 0-8-8Z"
              fill="var(--red)"
            />
            <circle cx="8" cy="8" r="3" fill="#ffffff" />
          </svg>
          Built for Ottawa. By the people, for the people.
        </p>
      </section>

      <LearnMore />
    </main>
  );
}
