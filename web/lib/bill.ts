export type Level = "municipal" | "provincial" | "federal";
export type BillStatus = "Introduced" | "In committee" | "In progress" | "Passed" | "Defeated";
export type Vote = "yes" | "no" | "none";

export const BILL_STATUSES: BillStatus[] = [
  "Introduced",
  "In committee",
  "In progress",
  "Passed",
  "Defeated",
];

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
  number: string;
  level: Level;
  /** Ward number for site-specific council items; null means city-wide. */
  wardNumber: number | null;
  title: string;
  status: BillStatus;
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
  /** Null until the address → representative lookup is connected. */
  repVote: Vote | null;
  lobbying: { group: string; meetings: number }[];
  stages: { label: string; done: boolean }[];
  sourceUrl: string;
};
