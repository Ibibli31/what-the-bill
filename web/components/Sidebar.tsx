"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import BillDetail, { RepDetail } from "@/components/BillDetail";
import { SAMPLE_BILLS, type Bill, type BillStatus, type Level } from "@/data/sampleBills";
import type { GeocodedLocation } from "@/services/geocoding";
import styles from "@/modules/Sidebar.module.css";

export type { Level };
export type SortOrder = "affects" | "recent" | "vote" | "lobbied";
export type TextStyle = "plain" | "official";

export type Filters = {
  level: Level;
  sort: SortOrder;
  statuses: BillStatus[];
  topics: string[];
  textStyle: TextStyle;
};

export type Representative = {
  name: string;
  district?: string;
  party?: string;
};

export const LEVELS: { id: Level; label: string; role: string; short: string }[] = [
  { id: "municipal", label: "Municipal", role: "Your councillor", short: "CLR" },
  { id: "provincial", label: "Provincial", role: "Your MPP", short: "MPP" },
  { id: "federal", label: "Federal", role: "Your MP", short: "MP" },
];

const SORTS: { id: SortOrder; label: string }[] = [
  { id: "affects", label: "Affects me most" },
  { id: "recent", label: "Most recent" },
  { id: "vote", label: "Vote coming up" },
  { id: "lobbied", label: "Most lobbied" },
];

const STATUSES: BillStatus[] = ["Introduced", "In committee", "Passed", "Defeated"];
const TOPICS = ["Housing", "Transit", "Taxes", "Cost of living", "Health", "Environment"];

export const DEFAULT_FILTERS: Filters = {
  level: "municipal",
  sort: "affects",
  statuses: [],
  topics: [],
  textStyle: "plain",
};

/** Mobile bottom-sheet positions, like Google Maps. */
type Snap = "peek" | "half" | "full";
const TOP_GAP = 72; // keeps the map's Back button visible above a full sheet
const PEEK = 132;

type Selection = { kind: "bill"; id: string } | { kind: "rep" } | null;

type SidebarProps = {
  location: GeocodedLocation;
  /** True while the map is full screen. Below 1000px the sidebar only shows then. */
  expanded: boolean;
  /** Called when a bill is opened, so the map can go full screen behind it. */
  onOpen?: () => void;
  /** Filled in once the ward/riding lookup exists. */
  ward?: string;
  representatives?: Partial<Record<Level, Representative>>;
  bills?: Bill[];
  onChange?: (filters: Filters) => void;
};

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function sortBills(bills: Bill[], sort: SortOrder) {
  const lobbied = (bill: Bill) => bill.lobbying.reduce((sum, item) => sum + item.meetings, 0);
  return [...bills].sort((a, b) => {
    switch (sort) {
      case "recent":
        return b.updated.localeCompare(a.updated);
      case "vote":
        return Number(b.voteSoon) - Number(a.voteSoon) || b.relevance - a.relevance;
      case "lobbied":
        return lobbied(b) - lobbied(a);
      default:
        return b.relevance - a.relevance;
    }
  });
}

const VOTE_LABEL = { yes: "Yes", no: "No", none: "No vote yet" } as const;

export default function Sidebar({
  location,
  expanded,
  onOpen,
  ward,
  representatives = {},
  bills = SAMPLE_BILLS,
  onChange,
}: SidebarProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [snap, setSnap] = useState<Snap>("half");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    onChange?.(filters);
  }, [filters, onChange]);

  // A new address starts fresh.
  useEffect(() => {
    setSelected(null);
    setCollapsed(false);
    setSnap("half");
  }, [location]);

  // Peeking only shows the top of the list, so bring the address back into view.
  useEffect(() => {
    if (snap === "peek" && panelRef.current) panelRef.current.scrollTop = 0;
  }, [snap]);

  // Details belong to the map view: closing the full-screen map closes them.
  useEffect(() => {
    if (!expanded) setSelected(null);
  }, [expanded]);

  // Close the details panel with Escape before the map handles it.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        setSelected(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [selected]);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function open(next: Selection) {
    setSelected(next);
    setCollapsed(false);
    if (snap === "peek") setSnap("half");
    onOpen?.();
  }

  const level = LEVELS.find((item) => item.id === filters.level)!;
  const rep = representatives[filters.level];

  const levelBills = useMemo(
    () => bills.filter((bill) => bill.level === filters.level),
    [bills, filters.level]
  );

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase();
    const matches = levelBills.filter(
      (bill) =>
        (filters.statuses.length === 0 || filters.statuses.includes(bill.status)) &&
        (filters.topics.length === 0 || bill.topics.some((t) => filters.topics.includes(t))) &&
        (!words || `${bill.number} ${bill.title} ${bill.summary}`.toLowerCase().includes(words))
    );
    return sortBills(matches, filters.sort);
  }, [levelBills, filters, query]);

  const activeCount =
    filters.statuses.length + filters.topics.length + (filters.sort === "affects" ? 0 : 1);
  const selectedBill =
    selected?.kind === "bill" ? bills.find((bill) => bill.id === selected.id) ?? null : null;

  // ---- Mobile sheet dragging -------------------------------------------------
  function sheetHeights() {
    const vh = window.innerHeight;
    return { peek: PEEK, half: Math.round(vh * 0.5), full: vh - TOP_GAP };
  }

  function onHandleDown(event: PointerEvent<HTMLDivElement>) {
    const shell = shellRef.current;
    if (!shell) return;
    dragRef.current = { y: event.clientY, h: shell.offsetHeight, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHandleMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = drag.y - event.clientY;
    if (Math.abs(dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    const { peek, full } = sheetHeights();
    setDragHeight(Math.min(full, Math.max(peek - 40, drag.h + dy)));
  }

  function onHandleUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (!drag.moved) {
      // Tap: step up, or drop back from full.
      setSnap((current) => (current === "peek" ? "half" : current === "half" ? "full" : "half"));
      return;
    }
    const heights = sheetHeights();
    const current = dragHeight ?? drag.h;
    const nearest = (Object.keys(heights) as Snap[]).reduce((best, key) =>
      Math.abs(heights[key] - current) < Math.abs(heights[best] - current) ? key : best
    );
    setSnap(nearest);
    setDragHeight(null);
  }

  return (
    <div
      ref={shellRef}
      className={styles.shell}
      data-sidebar=""
      data-expanded={expanded}
      data-collapsed={collapsed}
      data-detail={selected ? "open" : "closed"}
      data-snap={snap}
      data-dragging={dragHeight !== null}
      style={dragHeight !== null ? { height: dragHeight } : undefined}
    >
      {/* Phone only: drag or tap to resize the sheet */}
      <div
        className={styles.handle}
        role="button"
        tabIndex={0}
        aria-label={`Resize panel (${snap})`}
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSnap((current) => (current === "full" ? "peek" : current === "peek" ? "half" : "full"));
          }
        }}
      >
        <span />
      </div>

      <aside
        ref={panelRef}
        className={styles.panel}
        aria-label="Bills near you"
        inert={collapsed || undefined}
      >
        <div className={styles.titlebar}>
          <span className={styles.lights} aria-hidden="true">
            <i className={styles.lightRed} />
            <i className={styles.lightWhite} />
            <i className={styles.lightRed} />
          </span>
          <span className={styles.windowTitle}>results</span>
        </div>

        <div className={styles.head}>
          <p className={styles.label}>Your address</p>
          <p className={styles.address}>{location.displayName}</p>
          <p className={styles.meta}>
            ward <span>{ward ?? "pending"}</span>
          </p>

          <div className={styles.segmented} role="group" aria-label="Level of government">
            {LEVELS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filters.level === item.id}
                onClick={() => {
                  update("level", item.id);
                  setSelected((current) => (current?.kind === "rep" ? current : null));
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.rep}
            aria-pressed={selected?.kind === "rep"}
            onClick={() => open(selected?.kind === "rep" ? null : { kind: "rep" })}
          >
            <span className={styles.avatar} aria-hidden="true">
              {level.short}
            </span>
            <span className={styles.repText}>
              <span className={styles.repRole}>{level.role}</span>
              <span className={styles.repName}>{rep?.name ?? "Not loaded yet"}</span>
            </span>
            <span className={styles.chevron} aria-hidden="true">
              &gt;
            </span>
          </button>
        </div>

        <div className={styles.tools}>
          <div className={styles.searchRow}>
            <label htmlFor="bill-search" className="visually-hidden">
              Search bills
            </label>
            <input
              id="bill-search"
              type="search"
              className={styles.search}
              placeholder="Search bills"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="button"
              className={styles.filterToggle}
              aria-expanded={showFilters}
              aria-controls="bill-filters"
              onClick={() => setShowFilters((value) => !value)}
            >
              Filters{activeCount > 0 && <b>{activeCount}</b>}
            </button>
          </div>

          <div id="bill-filters" className={styles.filters} hidden={!showFilters}>
            <p className={styles.label}>Sort by</p>
            <div className={styles.chips} role="radiogroup" aria-label="Sort by">
              {SORTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  className={styles.chip}
                  aria-checked={filters.sort === item.id}
                  onClick={() => update("sort", item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className={styles.label}>Status</p>
            <div className={styles.chips} role="group" aria-label="Status">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={styles.chip}
                  aria-pressed={filters.statuses.includes(status)}
                  onClick={() => update("statuses", toggle(filters.statuses, status))}
                >
                  {status}
                </button>
              ))}
            </div>

            <p className={styles.label}>Topics</p>
            <div className={styles.chips} role="group" aria-label="Topics">
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={styles.chip}
                  aria-pressed={filters.topics.includes(topic)}
                  onClick={() => update("topics", toggle(filters.topics, topic))}
                >
                  {topic}
                </button>
              ))}
            </div>

            <p className={styles.label}>Show text as</p>
            <div className={styles.segmented} role="group" aria-label="Show text as">
              <button
                type="button"
                aria-pressed={filters.textStyle === "plain"}
                onClick={() => update("textStyle", "plain")}
              >
                Plain English
              </button>
              <button
                type="button"
                aria-pressed={filters.textStyle === "official"}
                onClick={() => update("textStyle", "official")}
              >
                Official text
              </button>
            </div>

            {activeCount > 0 && (
              <button
                type="button"
                className={styles.reset}
                onClick={() =>
                  setFilters((current) => ({
                    ...DEFAULT_FILTERS,
                    level: current.level,
                    textStyle: current.textStyle,
                  }))
                }
              >
                [ clear filters ]
              </button>
            )}
          </div>
        </div>

        <div className={styles.listHead}>
          <p className={styles.label}>Bills</p>
          <span>
            {visible.length} result{visible.length === 1 ? "" : "s"} · sample data
          </span>
        </div>

        <ul className={styles.list}>
          {visible.map((bill) => (
            <li key={bill.id}>
              <button
                type="button"
                className={styles.row}
                aria-current={selectedBill?.id === bill.id || undefined}
                onClick={() => open({ kind: "bill", id: bill.id })}
              >
                <span className={styles.rowTop}>
                  <span className={styles.number}>{bill.number}</span>
                  <span className={styles.status} data-status={bill.status}>
                    {bill.status}
                  </span>
                  {bill.voteSoon && bill.status !== "Passed" && bill.status !== "Defeated" && (
                    <span className={styles.soon}>Vote soon</span>
                  )}
                </span>
                <span className={styles.rowTitle}>{bill.title}</span>
                <span className={styles.rowSummary}>
                  {filters.textStyle === "plain" ? bill.summary : bill.officialSummary}
                </span>
                <span className={styles.rowVote}>
                  {level.short} voted <b data-vote={bill.repVote}>{VOTE_LABEL[bill.repVote]}</b>
                </span>
              </button>
            </li>
          ))}
          {visible.length === 0 && (
            <li className={styles.empty}>No bills match. Try clearing a filter.</li>
          )}
        </ul>
      </aside>

      {selected && (
        <aside
          className={styles.detail}
          aria-label="Details"
          key={selected.kind === "bill" ? selected.id : "rep"}
        >
          {selectedBill && (
            <BillDetail
              bill={selectedBill}
              role={level}
              textStyle={filters.textStyle}
              onClose={() => setSelected(null)}
            />
          )}
          {selected.kind === "rep" && (
            <RepDetail
              role={level}
              rep={rep}
              bills={levelBills}
              onOpenBill={(id) => setSelected({ kind: "bill", id })}
              onClose={() => setSelected(null)}
            />
          )}
        </aside>
      )}

      {/* Laptop/desktop: Google-Maps-style tab to slide the panels away */}
      <button
        type="button"
        className={styles.collapseTab}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Show side panel" : "Hide side panel"}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span aria-hidden="true">{collapsed ? ">" : "<"}</span>
      </button>
    </div>
  );
}