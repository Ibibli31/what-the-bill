"use client";

import { useState, type FormEvent } from "react";
import styles from "@/modules/LocationSearch.module.css";

export default function LocationSearch() {
  const [address, setAddress] = useState("");
  const hasValue = address.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasValue) return;
    // TODO: send the address to the api/ lookup endpoint,
    // then route to the results page with the users ward.
    console.log("Look up:", address.trim());
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search">
      <label htmlFor="location" className="visually-hidden">
        Enter your location
      </label>
      <input
        id="location"
        className={styles.input}
        type="text"
        inputMode="search"
        autoComplete="street-address"
        placeholder="Enter your location"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <button
        type="submit"
        className={styles.submit}
        aria-label="Find my representatives"
        data-visible={hasValue}
        tabIndex={hasValue ? 0 : -1}
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
    </form>
  );
}
