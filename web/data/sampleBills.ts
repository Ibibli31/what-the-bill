/**
 * PLACEHOLDER DATA — shapes only, not real bills.
 * Replace with the output of ingest/ + summarize/ once the API exists.
 */

export type Level = "municipal" | "provincial" | "federal";
export type BillStatus = "Introduced" | "In committee" | "Passed" | "Defeated";
export type Vote = "yes" | "no" | "none";

export type Bill = {
  id: string;
  number: string;
  level: Level;
  title: string;
  status: BillStatus;
  topics: string[];
  /** ISO date of the last activity, used for "Most recent". */
  updated: string;
  /** 0–100, how much it touches this address. Used for "Affects me most". */
  relevance: number;
  voteSoon: boolean;
  summary: string;
  officialSummary: string;
  impact: string;
  repVote: Vote;
  lobbying: { group: string; meetings: number }[];
  stages: { label: string; done: boolean }[];
  sourceUrl: string;
};

const stages = (reached: number, labels: string[]) =>
  labels.map((label, index) => ({ label, done: index < reached }));

const FEDERAL_STAGES = ["Introduced", "Second reading", "Committee", "Third reading", "Senate", "Royal assent"];
const PROVINCIAL_STAGES = ["Introduced", "Second reading", "Committee", "Third reading", "Royal assent"];
const COUNCIL_STAGES = ["Proposed", "Committee", "Council vote", "In effect"];

export const SAMPLE_BILLS: Bill[] = [
  {
    id: "m1",
    number: "By-law 0000-01",
    level: "municipal",
    title: "Sample: rental housing licensing",
    status: "In committee",
    topics: ["Housing"],
    updated: "2026-09-18",
    relevance: 92,
    voteSoon: true,
    summary:
      "Landlords with rental units in the city would need a yearly licence and a basic safety inspection. Tenants could look up whether a unit is licensed.",
    officialSummary:
      "A by-law to establish a residential rental housing licensing program, prescribing inspection standards, fees and enforcement provisions.",
    impact:
      "If you rent, your building would be inspected at least once a year. If you own a rental unit, you would pay an annual licence fee.",
    repVote: "none",
    lobbying: [
      { group: "Sample landlords association", meetings: 4 },
      { group: "Sample tenants' union", meetings: 2 },
    ],
    stages: stages(2, COUNCIL_STAGES),
    sourceUrl: "#",
  },
  {
    id: "m2",
    number: "Motion 0000-07",
    level: "municipal",
    title: "Sample: bus route frequency review",
    status: "Introduced",
    topics: ["Transit"],
    updated: "2026-09-02",
    relevance: 71,
    voteSoon: false,
    summary:
      "Asks city staff to study adding more buses on busy routes during rush hour and report back with costs.",
    officialSummary:
      "That staff be directed to review peak-period service levels on high-ridership routes and report back with options and budget implications.",
    impact: "Could shorten wait times on the routes closest to you if it goes ahead.",
    repVote: "yes",
    lobbying: [],
    stages: stages(1, COUNCIL_STAGES),
    sourceUrl: "#",
  },
  {
    id: "m3",
    number: "By-law 0000-12",
    level: "municipal",
    title: "Sample: property tax levy",
    status: "Passed",
    topics: ["Taxes", "Cost of living"],
    updated: "2026-06-11",
    relevance: 80,
    voteSoon: false,
    summary: "Sets this year's property tax rates for homes and businesses in the city.",
    officialSummary:
      "A by-law to levy and collect general and special area property taxes for the current taxation year.",
    impact: "Your property tax bill, or your rent if your landlord passes it on, changes with this rate.",
    repVote: "no",
    lobbying: [{ group: "Sample business improvement area", meetings: 1 }],
    stages: stages(4, COUNCIL_STAGES),
    sourceUrl: "#",
  },
  {
    id: "p1",
    number: "Bill 000",
    level: "provincial",
    title: "Sample: faster home building act",
    status: "In committee",
    topics: ["Housing", "Environment"],
    updated: "2026-09-15",
    relevance: 77,
    voteSoon: true,
    summary:
      "Speeds up approvals for new homes by shortening review timelines and limiting some appeals.",
    officialSummary:
      "An Act to amend various statutes with respect to land use planning, development approvals and related matters.",
    impact: "Could mean more construction near you, and fewer chances to object to a nearby project.",
    repVote: "yes",
    lobbying: [
      { group: "Sample home builders association", meetings: 6 },
      { group: "Sample environmental coalition", meetings: 3 },
    ],
    stages: stages(3, PROVINCIAL_STAGES),
    sourceUrl: "#",
  },
  {
    id: "p2",
    number: "Bill 000",
    level: "provincial",
    title: "Sample: walk-in clinic hours",
    status: "Introduced",
    topics: ["Health"],
    updated: "2026-08-28",
    relevance: 58,
    voteSoon: false,
    summary: "Would fund longer evening and weekend hours at walk-in clinics.",
    officialSummary: "An Act respecting access to primary care outside regular hours.",
    impact: "More options to see a doctor after work without going to an emergency room.",
    repVote: "none",
    lobbying: [{ group: "Sample medical association", meetings: 2 }],
    stages: stages(1, PROVINCIAL_STAGES),
    sourceUrl: "#",
  },
  {
    id: "f1",
    number: "Bill C-000",
    level: "federal",
    title: "Sample: grocery price transparency",
    status: "In committee",
    topics: ["Cost of living"],
    updated: "2026-09-20",
    relevance: 84,
    voteSoon: true,
    summary:
      "Large grocery chains would have to show unit prices clearly and report price changes on basic foods.",
    officialSummary:
      "An Act to amend the Competition Act and other Acts respecting pricing transparency in the retail food sector.",
    impact: "Easier to compare prices at the store; no direct change to what you pay.",
    repVote: "yes",
    lobbying: [
      { group: "Sample grocers council", meetings: 7 },
      { group: "Sample consumers association", meetings: 2 },
    ],
    stages: stages(3, FEDERAL_STAGES),
    sourceUrl: "#",
  },
  {
    id: "f2",
    number: "Bill C-000",
    level: "federal",
    title: "Sample: first-time buyer savings",
    status: "Defeated",
    topics: ["Housing", "Taxes"],
    updated: "2026-05-30",
    relevance: 63,
    voteSoon: false,
    summary: "Would have raised the tax-free amount first-time buyers can save for a down payment.",
    officialSummary: "An Act to amend the Income Tax Act (first home savings).",
    impact: "No change for now, since it did not pass.",
    repVote: "no",
    lobbying: [{ group: "Sample bankers association", meetings: 3 }],
    stages: stages(2, FEDERAL_STAGES),
    sourceUrl: "#",
  },
];