import type { Bill, BillStatus, Vote } from "@/lib/bill";
import { select } from "@/lib/supabase";

type FederalRow = {
  bill_id: number;
  number_code: string;
  title: string;
  plain_title: string | null;
  plain_summary: string | null;
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
type MppRow = { ridings: { code: string } | null };
type CouncillorRow = { wards: { ward_number: number } | null };

const BALLOT: Record<"yea" | "nay" | "paired" | "absent" | "abstain", Vote> = {
  yea: "yes",
  nay: "no",
  paired: "paired",
  absent: "absent",
  abstain: "abstain",
};

type ProvincialRow = {
  bill_id: number;
  bill_number: string;
  title: string;
  plain_title: string | null;
  plain_summary: string | null;
  sponsor_mpp_id: number | null;
  current_stage: string;
  last_activity_date: string | null;
  topic_tags: string[] | null;
  source_url: string;
  provincial_votes: {
    vote_label: string;
    vote_date: string;
    provincial_ballots: { ballot: "yea" | "nay" | "absent"; mpps: { ridings: { code: string } | null } }[];
  }[];
};

type MotionRow = {
  motion_id: number;
  motion_number: string;
  summary: string;
  plain_title: string | null;
  plain_summary: string | null;
  tags: string[] | null;
  wards: { ward_number: number } | null;
  result: "carried" | "lost" | "notice" | null;
  vote_kind: "none" | "dissent" | "recorded";
  motion_votes: { vote: "yea" | "nay" | "abstain"; councillors: { wards: { ward_number: number } | null } }[];
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
  plain_summary: string | null;
  source_url: string;
  wards: { ward_number: number } | null;
};

type ConsultationRow = {
  consultation_id: number;
  title: string;
  plain_title: string | null;
  plain_summary: string | null;
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

type Division = { label: string; date: string; order: number; ballots: Map<string, Vote> };

/**
 * Every member's ballot on the latest recorded division. Members with no ballot
 * row were absent; items with no recorded division get "none" for everyone.
 */
function latestDivision(divisions: Division[], codes: string[]) {
  const latest = [...divisions].sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order)[0];
  const votesByRiding = Object.fromEntries(
    codes.map((code): [string, Vote] => [code, latest ? latest.ballots.get(code) ?? "absent" : "none"])
  );
  return {
    votesByRiding,
    latestVote: latest ? { label: latest.label, date: latest.date } : null,
    voteContext: null,
  };
}

function federalVotes(row: FederalRow, ridingCodes: string[]) {
  return latestDivision(
    row.federal_votes.map((vote) => ({
      label: vote.vote_label,
      date: vote.vote_date,
      order: vote.division_number,
      ballots: new Map(vote.federal_ballots.map((b) => [b.mps.ridings.code, BALLOT[b.ballot]])),
    })),
    ridingCodes
  );
}

/** ola.org can hold two readings on one day; the later stage is the latest vote. */
const readingOrder = (label: string) => (/third/i.test(label) ? 3 : /second/i.test(label) ? 2 : 1);

function provincialVotes(row: ProvincialRow, ridingCodes: string[]) {
  return latestDivision(
    row.provincial_votes.map((vote) => ({
      label: vote.vote_label,
      date: vote.vote_date,
      order: readingOrder(vote.vote_label),
      ballots: new Map(
        vote.provincial_ballots.flatMap((b) =>
          b.mpps.ridings ? [[b.mpps.ridings.code, BALLOT[b.ballot]] as [string, Vote]] : []
        )
      ),
    })),
    ridingCodes
  );
}

/**
 * Council records individual votes only when a member asks for a recorded vote,
 * and committees only list their own members. Everything else carries by consensus,
 * so most motions have no per-councillor vote; `voteContext` says why.
 */
function motionVotes(row: MotionRow, wardKeys: string[]) {
  const meeting = row.meetings;
  const atCouncil = meeting.committee_name === "City Council";
  const ballots = new Map(
    row.motion_votes.flatMap((v) =>
      v.councillors.wards ? [[String(v.councillors.wards.ward_number), BALLOT[v.vote]] as [string, Vote]] : []
    )
  );
  // Labelled by where the vote happened: "City Council" or the committee's name.
  const division = { label: meeting.committee_name, date: meeting.meeting_date };
  const everyone = (vote: (key: string) => Vote) =>
    Object.fromEntries(wardKeys.map((key): [string, Vote] => [key, vote(key)]));

  if (row.vote_kind === "recorded" && ballots.size > 0) {
    return {
      // At committee, a missing councillor usually isn't on that committee rather than absent.
      votesByRiding: everyone((key) => ballots.get(key) ?? (atCouncil ? "absent" : "none")),
      latestVote: division,
      voteContext: atCouncil ? null : `Only members of the ${meeting.committee_name} vote at committee.`,
    };
  }
  if (row.vote_kind === "dissent" && ballots.size > 0) {
    return {
      votesByRiding: everyone((key) => ballots.get(key) ?? "noDissent"),
      latestVote: division,
      voteContext: "Council named only the councillors who dissented; everyone else went along with it.",
    };
  }

  const context =
    row.vote_kind === "dissent"
      ? "Carried with dissent, but the minutes don’t name who dissented."
      : row.result === "carried"
        ? "Carried without a recorded vote. Ottawa council only records each councillor’s vote when a member asks for one."
        : row.result === "lost"
          ? "Lost without a recorded vote."
          : "Not voted on yet.";
  return { votesByRiding: everyone(() => "none"), latestVote: null, voteContext: context };
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
    summary: row.plain_summary,
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

function toProvincial(row: ProvincialRow, ridingCodes: string[]): Bill {
  const topics = meaningfulTopics(row.topic_tags);
  const { status, reached } = provincialProgress(row.current_stage);
  return {
    id: `p-${row.bill_id}`,
    kind: "bill",
    number: `Bill ${row.bill_number}`,
    level: "provincial",
    ...provincialVotes(row, ridingCodes),
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
    summary: row.plain_summary,
    officialSummary: null,
    impact: null,
    repVote: null,
    lobbying: [],
    stages: stages(reached, PROVINCIAL_STAGES),
    sourceUrl: row.source_url,
  };
}

function toMotion(row: MotionRow, today: string, wardKeys: string[]): Bill {
  const topics = meaningfulTopics(row.tags);
  const { status, reached } = motionProgress(row);
  const meeting = row.meetings;
  return {
    id: `m-${row.motion_id}`,
    kind: "motion",
    number: `Motion ${row.motion_number}`,
    level: "municipal",
    ...motionVotes(row, wardKeys),
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
    summary: row.plain_summary,
    officialSummary: row.summary,
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
    voteContext: null,
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
    summary: row.plain_summary,
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
    voteContext: null,
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
    summary: row.plain_summary,
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
  const [federal, provincial, motions, devApps, consultations, mps, mpps, councillors] = await Promise.all([
    select<FederalRow>(
      "federal_bills",
      "select=bill_id,number_code,title,plain_title,plain_summary,status_name,origin_chamber,sponsor_mp_id,last_activity_date,topic_tags,source_url,federal_votes(division_number,vote_label,vote_date,federal_ballots(ballot,mps(ridings(code))))"
    ),
    select<ProvincialRow>(
      "provincial_bills",
      "select=bill_id,bill_number,title,plain_title,plain_summary,sponsor_mpp_id,current_stage,last_activity_date,topic_tags,source_url,provincial_votes(vote_label,vote_date,provincial_ballots(ballot,mpps(ridings(code))))"
    ),
    select<MotionRow>(
      "motions",
      "select=motion_id,motion_number,summary,plain_title,plain_summary,tags,result,vote_kind,wards(ward_number),meetings(committee_name,meeting_date,speak_by_date,source_url),motion_votes(vote,councillors(wards(ward_number)))"
    ),
    select<DevAppRow>(
      "dev_apps",
      "select=app_id,file_number,address,application_type,status,last_activity_date,plain_title,plain_summary,source_url,wards(ward_number)"
    ),
    select<ConsultationRow>(
      "consultations",
      "select=consultation_id,title,plain_title,plain_summary,closing_date,is_citywide,source_url,wards(ward_number)"
    ),
    select<MpRow>("mps", "select=ridings(code)"),
    select<MppRow>("mpps", "select=ridings(code)"),
    select<CouncillorRow>("councillors", "select=wards(ward_number)"),
  ]);
  const ridingCodes = mps.map((mp) => mp.ridings.code);
  const provincialCodes = mpps.flatMap((mpp) => (mpp.ridings ? [mpp.ridings.code] : []));
  // The mayor has no ward, so only ward councillors get a vote entry.
  const wardKeys = councillors.flatMap((c) => (c.wards ? [String(c.wards.ward_number)] : []));

  const today = new Date().toISOString().slice(0, 10);
  return [
    ...devApps.map(toDevApp),
    ...consultations.map((row) => toConsultation(row, today)),
    ...motions.filter((row) => meaningfulTopics(row.tags).length > 0).map((row) => toMotion(row, today, wardKeys)),
    ...provincial
      .filter((row) => meaningfulTopics(row.topic_tags).length > 0 || row.sponsor_mpp_id !== null)
      .map((row) => toProvincial(row, provincialCodes)),
    ...federal
      .filter((row) => meaningfulTopics(row.topic_tags).length > 0 || row.sponsor_mp_id !== null)
      .map((row) => toFederal(row, ridingCodes)),
  ];
}
