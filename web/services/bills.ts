import type { Bill, BillStatus } from "@/lib/bill";
import { select } from "@/lib/supabase";

type FederalRow = {
  bill_id: number;
  number_code: string;
  title: string;
  status_name: string;
  origin_chamber: "house" | "senate";
  sponsor_mp_id: number | null;
  last_activity_date: string | null;
  topic_tags: string[] | null;
  source_url: string;
  federal_votes: { vote_label: string; vote_date: string }[];
};

type ProvincialRow = {
  bill_id: number;
  bill_number: string;
  title: string;
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
  tags: string[] | null;
  result: "carried" | "lost" | "notice" | null;
  meetings: {
    committee_name: string;
    meeting_date: string;
    speak_by_date: string | null;
    source_url: string;
  };
};

type Progress = { status: BillStatus; reached: number };

const stages = (reached: number, labels: string[]) =>
  labels.map((label, index) => ({ label, done: index < reached }));

const PROVINCIAL_STAGES = ["Introduced", "Second reading", "Committee", "Third reading", "Royal assent"];
const COUNCIL_STAGES = ["Proposed", "Committee", "Council vote", "In effect"];

const CHAMBER = { house: "House of Commons", senate: "Senate" } as const;

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

function toFederal(row: FederalRow): Bill {
  const topics = meaningfulTopics(row.topic_tags);
  const { status, reached } = federalProgress(row);
  const otherChamber = row.origin_chamber === "house" ? "Senate" : "House of Commons";
  return {
    id: `f-${row.bill_id}`,
    number: `Bill ${row.number_code}`,
    level: "federal",
    title: row.title,
    status,
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
    number: `Bill ${row.bill_number}`,
    level: "provincial",
    title: row.title,
    status,
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
    number: `Motion ${row.motion_number}`,
    level: "municipal",
    title: meeting.committee_name,
    status,
    topics,
    updated: meeting.meeting_date,
    relevance: relevance(topics, true, meeting.meeting_date),
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

/**
 * All current bills and motions, newest data from Supabase.
 * Items tagged only "Other" are dropped unless an Ottawa MP/MPP sponsored them
 * (see db/schema.md, "Preset topics").
 */
export async function getBills(): Promise<Bill[]> {
  const [federal, provincial, motions] = await Promise.all([
    select<FederalRow>(
      "federal_bills",
      "select=bill_id,number_code,title,status_name,origin_chamber,sponsor_mp_id,last_activity_date,topic_tags,source_url,federal_votes(vote_label,vote_date)"
    ),
    select<ProvincialRow>(
      "provincial_bills",
      "select=bill_id,bill_number,title,sponsor_mpp_id,current_stage,last_activity_date,topic_tags,source_url"
    ),
    select<MotionRow>(
      "motions",
      "select=motion_id,motion_number,summary,tags,result,meetings(committee_name,meeting_date,speak_by_date,source_url)"
    ),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  return [
    ...motions.filter((row) => meaningfulTopics(row.tags).length > 0).map((row) => toMotion(row, today)),
    ...provincial
      .filter((row) => meaningfulTopics(row.topic_tags).length > 0 || row.sponsor_mpp_id !== null)
      .map(toProvincial),
    ...federal
      .filter((row) => meaningfulTopics(row.topic_tags).length > 0 || row.sponsor_mp_id !== null)
      .map(toFederal),
  ];
}
