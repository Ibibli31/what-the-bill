"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  MIN_QUERY_LENGTH,
  searchLocations,
  type LocationSuggestion,
} from "@/services/locationSearch";
import styles from "@/modules/LocationSearch.module.css";

const DEBOUNCE_MS = 400;
// Roughly five suggestions plus the attribution line.
const PANEL_HEIGHT_ESTIMATE = 260;
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 12;

type SuggestionStatus = "idle" | "loading" | "done" | "error";

type LocationSearchProps = {
  onSearch: (address: string) => void;
  onSelect: (location: LocationSuggestion) => void;
  busy?: boolean;
  error?: string | null;
};

export default function LocationSearch({
  onSearch,
  onSelect,
  busy = false,
  error = null,
}: LocationSearchProps) {
  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [status, setStatus] = useState<SuggestionStatus>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [placement, setPlacement] = useState<{ above: boolean; maxHeight: number }>({
    above: false,
    maxHeight: PANEL_HEIGHT_ESTIMATE,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  // The text a suggestion just filled in; typing it doesn't need a new search.
  const pickedRef = useRef<string | null>(null);
  const hasValue = address.trim().length > 0;

  function cancelPending() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
  }

  useEffect(() => {
    const query = address.trim();
    if (query === pickedRef.current) return;
    pickedRef.current = null;
    cancelPending();

    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setStatus("idle");
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      requestRef.current = controller;
      setStatus("loading");
      setOpen(document.activeElement === inputRef.current);
      try {
        const results = await searchLocations(query, controller.signal);
        if (controller.signal.aborted) return;
        setSuggestions(results);
        setActiveIndex(-1);
        setStatus("done");
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Location suggestions failed:", err);
        setSuggestions([]);
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return cancelPending;
  }, [address]);

  function pick(suggestion: LocationSuggestion) {
    cancelPending();
    pickedRef.current = suggestion.displayName;
    setAddress(suggestion.displayName);
    setSuggestions([]);
    setStatus("idle");
    setOpen(false);
    onSelect(suggestion);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasValue || busy) return;
    cancelPending();
    setOpen(false);
    onSearch(address.trim());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = suggestions.length;
    if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % count);
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (event.key === "Enter" && open && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const statusText =
    status === "loading"
      ? "Searching…"
      : status === "error"
        ? "Unable to search locations. Please try again."
        : status === "done" && suggestions.length === 0
          ? "No locations found."
          : null;
  const showPanel = open && (suggestions.length > 0 || statusText !== null);

  // The card is centred and the page doesn't scroll, so open upwards when there's no room below.
  useLayoutEffect(() => {
    if (!showPanel || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    const above = rect.top - PANEL_GAP - VIEWPORT_MARGIN;
    const openAbove = below < PANEL_HEIGHT_ESTIMATE && above > below;
    setPlacement({ above: openAbove, maxHeight: Math.max(openAbove ? above : below, 120) });
  }, [showPanel]);

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search" aria-busy={busy}>
      <label htmlFor="location" className={styles.label}>
        Your location
      </label>
      <div className={styles.field}>
        <input
          ref={inputRef}
          id="location"
          className={styles.input}
          type="text"
          inputMode="search"
          autoComplete="off"
          placeholder="Enter your location"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(suggestions.length > 0)}
          onBlur={() => setOpen(false)}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls="location-suggestions"
          aria-activedescendant={
            showPanel && activeIndex >= 0 ? `location-suggestion-${activeIndex}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "location-error" : undefined}
        />
        <button
          type="submit"
          className={styles.submit}
          aria-label="Find my representatives"
          data-visible={hasValue}
          tabIndex={hasValue ? 0 : -1}
          disabled={busy}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {showPanel && (
          // Keep focus in the input when the list is clicked, so the pick registers before blur.
          <div
            className={styles.suggestions}
            data-placement={placement.above ? "above" : "below"}
            style={{ maxHeight: placement.maxHeight }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {suggestions.length > 0 && (
              <ul id="location-suggestions" role="listbox" className={styles.suggestionList}>
                {suggestions.map((suggestion, i) => (
                  <li
                    key={suggestion.displayName}
                    id={`location-suggestion-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={styles.suggestion}
                    data-active={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => pick(suggestion)}
                  >
                    {suggestion.displayName}
                  </li>
                ))}
              </ul>
            )}
            {statusText && (
              <p className={styles.suggestionStatus} role="status">
                {statusText}
              </p>
            )}
            <p className={styles.attribution}>
              Suggestions ©{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>{" "}
              contributors
            </p>
          </div>
        )}
      </div>

      {error && (
        <p id="location-error" className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}