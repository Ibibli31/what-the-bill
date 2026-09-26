"use client";

import { useEffect, useState, type ReactNode } from "react";
import pageStyles from "@/modules/page.module.css";
import styles from "@/modules/LearnMore.module.css";

type Feature = { title: string; body: string; icon: ReactNode };

const FEATURES: Feature[] = [
  {
    title: "See what's happening near you",
    body: "Zoning, development, road work and council news.",
    icon: (
      <>
        <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" />
        <circle cx="12" cy="11" r="2.2" />
      </>
    ),
  },
  {
    title: "Understand the details",
    body: "Government info in simple, plain English.",
    icon: (
      <>
        <path d="M7 3h7l4 4v14H7Z" />
        <path d="M14 3v4h4M10 12h5M10 15h5M10 18h3" />
      </>
    ),
  },
  {
    title: "Explore federal bills",
    body: "How bills affect you and how your MP voted.",
    icon: (
      <>
        <path d="M4 9 12 4l8 5M5 9h14M4 20h16M6 12v5M10 12v5M14 12v5M18 12v5" />
      </>
    ),
  },
  {
    title: "Take action",
    body: "Comment, email your councillor or contact your MP.",
    icon: (
      <>
        <rect x="3.5" y="6" width="17" height="12" rx="1" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
  },
  {
    title: "A more informed you",
    body: "Your voice helps build a more open government.",
    icon: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="16.5" cy="10" r="2.3" />
        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M14.5 14.4c.6-.3 1.3-.4 2-.4 2.3 0 4 1.6 4 4" />
      </>
    ),
  },
];

export default function LearnMore() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <aside id="learn-more" className={styles.panel} aria-labelledby="learn-more-title">
          <div className={styles.titlebar}>
            <span id="learn-more-title" className={styles.windowTitle}>
              About What The Bill
            </span>
          </div>

          <ul className={styles.list}>
            {FEATURES.map((feature) => (
              <li key={feature.title} className={styles.item}>
                <span className={styles.icon} aria-hidden="true">
                  <svg viewBox="0 0 24 24">{feature.icon}</svg>
                </span>
                <div>
                  <h2 className={styles.title}>{feature.title}</h2>
                  <p className={styles.body}>{feature.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <button
        type="button"
        className={pageStyles.learnMore}
        aria-expanded={open}
        aria-controls="learn-more"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        {open ? "Hide" : "Learn more"}
      </button>
    </>
  );
}
