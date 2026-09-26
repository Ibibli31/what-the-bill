import type { Bill, BillStatus, Vote } from "@/lib/bill";
import { select } from "@/lib/supabase";

type FederalRow = {
  bill_id: number;
  number_code: string;
  title: string;
  plain_title: string | null;
  status_name: string;
  origin_chamber: "house" | "senate";
  sponsor_mp_id: number | null;
  last_activity_date: string | null;
  topic_tags: string[] | null;
  source_url: string;
  federal_votes: {
    division_number: number;
    vote_label: string;
    vote_date: string;
    federal_ballots: { ballot: "yea" | "nay" | "paired"; mps: { ridings: { code: string } } }[];
  }[];
};

type MpRow = { ridings: { code: string } };

const BALLOT: Record<"yea" | "nay" | "paired", Vote> = { yea: "yes", nay: "no", paired: "paired" };

type ProvincialRow = {
  bill_id: number;
  bill_number: string;
  title: string;
  plain_title: string | null;
  sponsor_mpp_id: number | null;
  current_stage: string;
  last_activity_date: string | null;
  topic_tags: string[] | null;
  source_url: string;
};

type MotionRow = {
  motion_id: number;
  motion_number: string;
  summary: string;
  plain_title: string | null;
  tags: string[] | null;
  wards: { ward_number: number } | null;
  result: "carried" | "lost" | "notice" | null;
  meetings: {
    committee_name: string;
    meeting_date: string;
    speak_by_date: string | null;
    source_url: string;
  };
};

type DevAppRow = {
  app_id: number;
  file_number: string;
  address: string | null;
  application_type: string;
  status: string;
  last_activity_date: string | null;
  plain_title: string | null;
  source_url: string;
  wards: { ward_number: number } | null;
};

type ConsultationRow = {
  consultation_id: number;
  title: string;
  plain_title: string | null;
  closing_date: string | null;
  is_citywide: boolean;
  source_url: string;
  wards: { ward_number: number } | null;
};

type Progress = { status: BillStatus; reached: number };

const stages = (reached: number, labels: string[]) =>
  labels.map((label, index) => ({ label, done: index < reached }));

const PROVINCIAL_STAGES = ["Introduced", "Second reading", "Committee", "Third reading", "Royal assent"];
const COUNCIL_STAGES = ["Proposed", "Committee", "Council vote", "In effect"];

const DEV_APP_STAGES = ["Filed", "Under review", "Decision", "In effect"];
const CONSULTATION_STAGES = ["Open for feedback", "Feedback closed", "Report to Council"];

const CHAMBER = { house: "House of Commons", senate: "Senate" } as const;

/** "2026-10-12" → "Oct 12, 2026". Dates are calendar days, so format them in UTC. */
function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Council's own wording for where a motion stands. */
function motionLabel(row: MotionRow) {
  const atCouncil = row.meetings.committee_name === "City Council";
  switch (row.result) {
    case "carried":
      return atCouncil ? "Carried" : "Carried at committee";
    case "lost":
      return "Lost";
    case "notice":
      return "Notice of motion";
    default:
      return atCouncil ? "On Council's agenda" : "At committee";
  }
}

/** Maps LEGISinfo's status_name (e.g. "At second reading in the Senate") onto our stages. */
function federalProgress(row: FederalRow): Progress {
  const status = row.status_name.toLowerCase();
  if (status.includes("royal assent")) return { status: "Passed", reached: 6 };
  if (status.includes("defeated")) {
    const lastVote = [...row.federal_votes].sort((a, b) => b.vote_date.localeCompare(a.vote_date))[0];
    return { status: "Defeated", reached: lastVote?.vote_label.includes("Third") ? 4 : 2 };
  }

  const chamber = row.status_name.match(/in the (Senate|House of Commons)$/)?.[1];
  const inCommittee = status.includes("committee") || status.includes("report stage");
  if (chamber && chamber !== CHAMBER[row.origin_chamber]) {
    return { status: inCommittee ? "In committee" : "In progress", reached: 5 };
  }
  if (status.includes("third reading")) return { status: "In progress", reached: 4 };
  if (inCommittee) return { status: "In committee", reached: 3 };
  if (status.includes("second reading")) return { status: "Introduced", reached: 2 };
  // First reading, pro forma, awaiting first reading, outside the order of precedence.
  return { status: "Introduced", reached: 1 };
}

/** Maps the latest ola.org stage-history row (e.g. "Second Reading | Vote | Lost on division"). */
function provincialProgress(stage: string): Progress {
  const s = stage.toLowerCase();
  if (s.startsWith("royal assent")) return { status: "Passed", reached: 5 };
  if (s.includes("lost")) return { status: "Defeated", reached: 2 };
  if (s.includes("third reading")) return { status: "In progress", reached: 4 };
  if (s.includes("committee") || s.includes("consideration of a bill")) {
    return { status: "In committee", reached: 3 };
  }
  if (s.startsWith("second reading")) return { status: "Introduced", reached: 2 };
  return { status: "Introduced", reached: 1 };
}

function motionProgress(row: MotionRow): Progress {
  const atCouncil = row.meetings.committee_name === "City Council";
  switch (row.result) {
    case "carried":
      return atCouncil ? { status: "Passed", reached: 4 } : { status: "In progress", reached: 2 };
    case "lost":
      return { status: "Defeated", reached: atCouncil ? 3 : 2 };
    case "notice":
      return { status: "Introduced", reached: 1 };
    default:
      return atCouncil ? { status: "Introduced", reached: 1 } : { status: "In committee", reached: 2 };
  }
}

/** Maps a development application's City status text onto our stages. */
function devAppProgress(status: string): Progress {
  const s = status.toLowerCase();
  if (["in effect", "by-law passed", "approved", "adopted"].some((word) => s.includes(word))) {
    return { status: "Passed", reached: s.includes("in effect") ? 4 : 3 };
  }
  if (s.includes("notice of decision") || s.includes("appeal period")) {
    return { status: "In progress", reached: 3 };
  }
  if (s.includes("file pending") || s.includes("reactivated")) return { status: "Introduced", reached: 1 };
  return { status: "In progress", reached: 2 };
}

/** Tags other than "Other" mean the item touches daily Ottawa life. */
function meaningfulTopics(tags: string[] | null) {
  return (tags ?? []).filter((tag) => tag !== "Other");
}

/**
 * Placeholder score until the address lookup exists: favours items that touch
 * daily life, are local (council or an Ottawa MP/MPP), and moved recently.
 */
function relevance(topics: string[], local: boolean, updated: string | null) {
  const days = updated ? (Date.now() - Date.parse(updated)) / 86_400_000 : 365;
  const recency = Math.max(0, 1 - days / 365);
  return Math.round(40 + (topics.length > 0 ? 20 : 0) + (local ? 25 : 0) + 15 * recency);
}

/**
 * Every Ottawa MP's ballot on the bill's latest recorded division. MPs with no
 * ballot row were absent; bills with no recorded division get "none" for everyone.
 */
function federalVotes(row: FederalRow, ridingCodes: string[]) {
  const latest = [...row.federal_votes].sort(
    (a, b) => b.vote_date.localeCompare(a.vote_date) || b.division_number - a.division_number
  )[0];
  const ballots = new Map(
    latest?.federal_ballots.map((ballot) => [ballot.mps.ridings.code, BALLOT[ballot.ballot]])
  );
  const votesByRiding = Object.fromEntries(
    ridingCodes.map((code): [string, Vote] => [code, latest ? ballots.get(code) ?? "absent" : "none"])
  );
  return {
    votesByRiding,
    latestVote: latest ? { label: latest.vote_label, date: latest.vote_date } : null,
  };
}

function toFederal(row: FederalRow, ridingCodes: string[]): Bill {
  const topics = meaningfulTopics(row.topic_tags);
  const { status, reached } = federalProgress(row);
  const otherChamber = row.origin_chamber === "house" ? "Senate" : "House of Commons";
  return {
    id: `f-${row.bill_id}`,
    kind: "bill",
    number: `Bill ${row.number_code}`,
    level: "federal",
    wardNumber: null,
    ...federalVotes(row, ridingCodes),
    title: row.plain_title ?? row.title,
    officialTitle: row.title,
    status,
    statusLabel: status,
    facts: [],
    topics,
    updated: row.last_activity_date ?? "",
    relevance: relevance(topics, row.sponsor_mp_id !== null, row.last_activity_date),
    voteSoon: false,
    summary: null,
    officialSummary: null,
    impact: null,
    repVote: null,
    lobbying: [],
    stages: stages(reached, [
      "Introduced",
      "Second reading",
      "Committee",
      "Third reading",
      otherChamber,
      "Royal assent",
    ]),
    sourceUrl: row.source_url,
  };
}

function toProvincial(row: ProvincialRow): Bill {
  const topics = meaningfulTopics(row.topic_tags);
  const { status, reached } = provincialProgress(row.current_stage);
  return {
    id: `p-${row.bill_id}`,
    kind: "bill",
    number: `Bill ${row.bill_number}`,
    level: "provincial",
    votesByRiding: null,
    latestVote: null,
    wardNumber: null,
    title: row.plain_title ?? row.title,
    officialTitle: row.title,
    status,
    statusLabel: status,
    facts: [],
    topics,
    updated: row.last_activity_date ?? "",
    relevance: relevance(topics, row.sponsor_mpp_id !== null, row.last_activity_date),
    voteSoon: false,
    summary: null,
    officialSummary: null,
    impact: null,
    repVote: null,
    lobbying: [],
    stages: stages(reached, PROVINCIAL_STAGES),
    sourceUrl: row.source_url,
  };
}

function toMotion(row: MotionRow, today: string): Bill {
  const topics = meaningfulTopics(row.tags);
  const { status, reached } = motionProgress(row);
  const meeting = row.meetings;
  return {
    id: `m-${row.motion_id}`,
    kind: "motion",
    number: `Motion ${row.motion_number}`,
    level: "municipal",
    votesByRiding: null,
    latestVote: null,
    wardNumber: row.wards?.ward_number ?? null,
    title: row.plain_title ?? meeting.committee_name,
    officialTitle: meeting.committee_name,
    status,
    statusLabel: motionLabel(row),
    facts: [
      { label: "Meeting", value: `${meeting.committee_name}, ${formatDate(meeting.meeting_date)}` },
      ...(meeting.speak_by_date && meeting.speak_by_date >= today
        ? [{ label: "Register to speak by", value: formatDate(meeting.speak_by_date) }]
        : []),
    ],
    topics,
    updated: meeting.meeting_date,
    relevance: Math.min(100, relevance(topics, true, meeting.meeting_date) + (row.wards ? 10 : 0)),
    voteSoon: meeting.meeting_date >= today || (meeting.speak_by_date ?? "") >= today,
    summary: row.summary,
    officialSummary: null,
    impact: null,
    repVote: null,
    lobbying: [],
    stages: stages(reached, COUNCIL_STAGES),
    sourceUrl: meeting.source_url,
  };
}

function toDevApp(row: DevAppRow): Bill {
  const topics = ["Housing & Development"];
  const { status, reached } = devAppProgress(row.status);
  const officialTitle = `${row.application_type} – ${row.address ?? "City-wide"}`;
  return {
    id: `d-${row.app_id}`,
    kind: "devApp",
    number: `Application ${row.file_number}`,
    level: "municipal",
    votesByRiding: null,
    latestVote: null,
    wardNumber: row.wards?.ward_number ?? null,
    title: row.plain_title ?? officialTitle,
    officialTitle,
    status,
    statusLabel: row.status,
    facts: [
      ...(row.address ? [{ label: "Address", value: row.address }] : []),
      { label: "Application type", value: row.application_type },
      { label: "File number", value: row.file_number },
      ...(row.last_activity_date ? [{ label: "Last update", value: formatDate(row.last_activity_date) }] : []),
    ],
    topics,
    updated: row.last_activity_date ?? "",
    relevance: Math.min(100, relevance(topics, true, row.last_activity_date) + (row.wards ? 10 : 0)),
    voteSoon: row.status.toLowerCase().includes("comment period in progress"),
    summary: null,
    officialSummary: null,
    impact: null,
    repVote: null,
    lobbying: [],
    stages: stages(reached, DEV_APP_STAGES),
    sourceUrl: row.source_url,
  };
}

function toConsultation(row: ConsultationRow, today: string): Bill {
  const open = row.closing_date === null || row.closing_date >= today;
  return {
    id: `c-${row.consultation_id}`,
    kind: "consultation",
    number: "Consultation",
    level: "municipal",
    votesByRiding: null,
    latestVote: null,
    wardNumber: row.is_citywide ? null : row.wards?.ward_number ?? null,
    title: row.plain_title ?? row.title,
    officialTitle: row.title,
    status: open ? "Open" : "Closed",
    statusLabel: open
      ? row.closing_date
        ? `Open until ${formatDate(row.closing_date).replace(/, \d{4}$/, "")}`
        : "Open"
      : "Closed",
    facts: [
      {
        label: open ? "Closes" : "Closed",
        value: row.closing_date ? formatDate(row.closing_date) : "No closing date set",
      },
      {
        label: "Who it affects",
        value: row.is_citywide || !row.wards ? "The whole city" : `Ward ${row.wards.ward_number}`,
      },
    ],
    topics: [],
    updated: row.closing_date ?? "",
    relevance: Math.min(100, relevance([], true, row.closing_date) + (row.wards ? 10 : 0)),
    voteSoon: open && row.closing_date !== null,
    summary: null,
    officialSummary: null,
    impact: null,
    repVote: null,
    lobbying: [],
    stages: stages(open ? 1 : 2, CONSULTATION_STAGES),
    sourceUrl: row.source_url,
  };
}

/**
 * All current bills, council motions, development applications and consultations from Supabase.
 * Items tagged only "Other" are dropped unless an Ottawa MP/MPP sponsored them
 * (see db/schema.md, "Preset topics").
 */
export async function getBills(): Promise<Bill[]> {
  const [federal, provincial, motions, devApps, consultations, mps] = await Promise.all([
    select<FederalRow>(
      "federal_bills",
      "select=bill_id,number_code,title,plain_title,status_name,origin_chamber,sponsor_mp_id,last_activity_date,topic_tags,source_url,federal_votes(division_number,vote_label,vote_date,federal_ballots(ballot,mps(ridings(code))))"
    ),
    select<ProvincialRow>(
      "provincial_bills",
      "select=bill_id,bill_number,title,plain_title,sponsor_mpp_id,current_stage,last_activity_date,topic_tags,source_url"
    ),
    select<MotionRow>(
      "motions",
      "select=motion_id,motion_number,summary,plain_title,tags,result,wards(ward_number),meetings(committee_name,meeting_date,speak_by_date,source_url)"
    ),
    select<DevAppRow>(
      "dev_apps",
      "select=app_id,file_number,address,application_type,status,last_activity_date,plain_title,source_url,wards(ward_number)"
    ),
    select<ConsultationRow>(
      "consultations",
      "select=consultation_id,title,plain_title,closing_date,is_citywide,source_url,wards(ward_number)"
    ),
    select<MpRow>("mps", "select=ridings(code)"),
  ]);
  const ridingCodes = mps.map((mp) => mp.ridings.code);

  const today = new Date().toISOString().slice(0, 10);
  return [
    ...devApps.map(toDevApp),
    ...consultations.map((row) => toConsultation(row, today)),
    ...motions.filter((row) => meaningfulTopics(row.tags).length > 0).map((row) => toMotion(row, today)),
    ...provincial
      .filter((row) => meaningfulTopics(row.topic_tags).length > 0 || row.sponsor_mpp_id !== null)
      .map(toProvincial),
    ...federal
      .filter((row) => meaningfulTopics(row.topic_tags).length > 0 || row.sponsor_mp_id !== null)
      .map((row) => toFederal(row, ridingCodes)),
  ];
}
