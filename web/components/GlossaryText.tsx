"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";
import styles from "@/modules/GlossaryText.module.css";

// One regex for every term; capture group i + 1 is GLOSSARY[i].
const MATCHER = new RegExp(`\\b(?:${GLOSSARY.map((t) => `(${t.pattern})`).join("|")})\\b`, "gi");
const EXACT = GLOSSARY.map((t) => (t.caseSensitive ? new RegExp(`^(?:${t.pattern})$`) : null));

const GAP = 8;
const EDGE = 8;

/**
 * Renders text with glossary words underlined. Hover, tap or focus one to see
 * a plain-English definition. Only the first mention of each term is marked.
 */
export default function GlossaryText({ children }: { children: string | null | undefined }) {
  if (!children) return null;

  const parts: ReactNode[] = [];
  const seen = new Set<number>();
  let last = 0;

  for (const match of children.matchAll(MATCHER)) {
    const index = match.slice(1).findIndex((group) => group !== undefined);
    if (index === -1 || seen.has(index) || (EXACT[index] && !EXACT[index]!.test(match[0]))) continue;
    seen.add(index);
    if (match.index > last) parts.push(children.slice(last, match.index));
    parts.push(
      <Term key={match.index} term={GLOSSARY[index]}>
        {match[0]}
      </Term>
    );
    last = match.index + match[0].length;
  }
  if (last === 0) return <>{children}</>;
  if (last < children.length) parts.push(children.slice(last));
  return <>{parts}</>;
}

function Term({ term, children }: { term: GlossaryTerm; children: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const touchRef = useRef(false);
  const id = useId();

  // Place the card above the word, or below if there's no room, kept on screen.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tipRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const above = anchor.top - tip.height - GAP;
    const top = above >= EDGE ? above : anchor.bottom + GAP;
    const centered = anchor.left + anchor.width / 2 - tip.width / 2;
    const left = Math.min(Math.max(EDGE, centered), window.innerWidth - tip.width - EDGE);
    setPosition({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Runs before the sidebar's Escape handler, so Escape closes the card first.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function show() {
    setPosition(null);
    setOpen(true);
  }

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.term}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onPointerDown={(event) => {
          touchRef.current = event.pointerType !== "mouse";
        }}
        onPointerEnter={(event) => event.pointerType === "mouse" && show()}
        onPointerLeave={(event) => event.pointerType === "mouse" && setOpen(false)}
        onFocus={() => !touchRef.current && show()}
        onBlur={() => setOpen(false)}
        onClick={() => {
          // Touch has no hover: tap to open, tap again to close.
          if (!touchRef.current) return;
          if (open) setOpen(false);
          else show();
        }}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            id={id}
            role="tooltip"
            className={styles.tip}
            style={position ?? { top: 0, left: 0, visibility: "hidden" }}
          >
            <span className={styles.tipTerm}>{term.term}</span>
            <span className={styles.tipText}>{term.definition}</span>
          </span>,
          document.body
        )}
    </>
  );
}
