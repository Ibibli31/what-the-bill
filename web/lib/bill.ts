export type Level = "municipal" | "provincial" | "federal";
/** What an item is. Provincial and federal items are always bills; council has three kinds. */
export type ItemKind = "bill" | "motion" | "devApp" | "consultation";
/** Shared vocabulary for the Status filter; `statusLabel` holds each source's own wording. */
export type BillStatus =
  | "Introduced"
  | "In committee"
  | "In progress"
  | "Passed"
  | "Defeated"
  | "Open"
  | "Closed";
/**
 * "none" = no vote recorded for this member; "paired"/"absent"/"abstain" = they didn't vote.
 * "noDissent" = council recorded only dissenters, and this councillor wasn't one.
 */
export type Vote = "yes" | "no" | "paired" | "absent" | "abstain" | "noDissent" | "none";

export const VOTE_LABEL: Record<Vote, string> = {
  yes: "Yes",
  no: "No",
  paired: "Paired",
  absent: "Absent",
  abstain: "Abstained",
  noDissent: "Didn't dissent",
  none: "No recorded vote",
};

export const BILL_STATUSES: BillStatus[] = [
  "Introduced",
  "In committee",
  "In progress",
  "Passed",
  "Defeated",
  "Open",
  "Closed",
];

export const KIND_LABELS: Record<ItemKind, { one: string; many: string }> = {
  bill: { one: "Bill", many: "Bills" },
  motion: { one: "Motion", many: "Motions" },
  consultation: { one: "Consultation", many: "Consultations" },
  devApp: { one: "Development", many: "Development" },
};

/** The "soon" badge: a vote for bills and motions, a deadline for the rest. */
export const SOON_LABEL: Record<ItemKind, string> = {
  bill: "Vote soon",
  motion: "Vote soon",
  consultation: "Closing soon",
  devApp: "Comments open",
};

/** The closed tag vocabulary used by `topic_tags` / `tags` in the database. */
export const TOPICS = [
  "Housing & Development",
  "Transit & Roads",
  "Cost of Living & Taxes",
  "Environment & Climate",
  "Public Safety",
  "Health & Social Services",
  "Parks & Recreation",
  "Education & Schools",
  "Municipal/Cities' Powers & Governance",
];

export type Bill = {
  id: string;
  kind: ItemKind;
  number: string;
  level: Level;
  /** Ward number for site-specific council items; null means city-wide. */
  wardNumber: number | null;
  /** Plain-language title, falling back to the official one until it is generated. */
  title: string;
  /** Title as published (the committee name for council motions). */
  officialTitle: string;
  status: BillStatus;
  /** Status as the source words it, e.g. "Carried", "Open until Oct 12", "Notice of Decision". */
  statusLabel: string;
  /** Kind-specific facts for the details panel, e.g. address and application type. */
  facts: { label: string; value: string }[];
  topics: string[];
  /** ISO date of the last activity, used for "Most recent". Empty if unknown. */
  updated: string;
  /** 0–100, how much it touches this address. Used for "Affects me most". */
  relevance: number;
  voteSoon: boolean;
  /** Plain-English summary. Null until the summarize/ job has written one. */
  summary: string | null;
  officialSummary: string | null;
  impact: string | null;
  /** This address's representative's vote. Filled in by the sidebar; null if unknown. */
  repVote: Vote | null;
  /**
   * Each member's vote on the latest recorded division, keyed by riding code
   * (ward number for councillors).
   * Null where no voting data is loaded for this level.
   */
  votesByRiding: Record<string, Vote> | null;
  /** The division `votesByRiding` comes from, e.g. "Third Reading" on 2026-03-25. */
  latestVote: { label: string; date: string } | null;
  /** Why members have no individual vote, e.g. council passed it by consensus. */
  voteContext: string | null;
  lobbying: { group: string; meetings: number }[];
  stages: { label: string; done: boolean }[];
  sourceUrl: string;
};
