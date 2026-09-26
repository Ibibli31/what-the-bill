"use client";

import { VOTE_LABEL, type Bill, type ItemKind, type Vote } from "@/lib/bill";
import type { Representative, TextStyle } from "@/components/Sidebar";
import GlossaryText from "@/components/GlossaryText";
import styles from "@/modules/BillDetail.module.css";

type Role = { role: string; short: string; label: string };

/** Per-kind wording: what the summary is called and where the source link goes. */
const COPY: Record<ItemKind, { about: string; source: string }> = {
  bill: { about: "What it does", source: "Read the official text" },
  motion: { about: "What it does", source: "View the meeting record" },
  consultation: { about: "What it’s about", source: "View the consultation" },
  devApp: { about: "What’s proposed", source: "View the application" },
};

/** The one thing to do next, when there is one. Opens the same page as the source link. */
function nextAction(bill: Bill) {
  if (bill.kind === "consultation" && bill.status === "Open") return "Give feedback";
  if (bill.kind === "devApp" && bill.voteSoon) return "Comment on this application";
  return null;
}

function voteNote(vote: Vote, bill: Bill) {
  const on = bill.latestVote ? ` on ${bill.latestVote.label.toLowerCase()} (${bill.latestVote.date})` : "";
  switch (vote) {
    case "none":
      return "No recorded vote on this bill. Many bills pass stages without one.";
    case "paired":
      return `Paired${on}: agreed with a member on the other side that neither would vote.`;
    case "absent":
      return `Didn't vote in the recorded division${on}.`;
    default:
      return `Recorded division${on}.`;
  }
}

function Titlebar({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className={styles.titlebar}>
      {/* Phones/tablets: the details cover the list, so this reads as "back" */}
      <button type="button" className={styles.back} onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M19 12H5M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>
      <span className={styles.windowTitle}>{title}</span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default function BillDetail({
  bill,
  role,
  textStyle,
  onClose,
}: {
  bill: Bill;
  role: Role;
  textStyle: TextStyle;
  onClose: () => void;
}) {
  const totalMeetings = bill.lobbying.reduce((sum, item) => sum + item.meetings, 0);
  const maxMeetings = Math.max(1, ...bill.lobbying.map((item) => item.meetings));
  const summary = textStyle === "plain" ? bill.summary : bill.officialSummary;
  // Votes and lobbying are recorded for bills and council motions only.
  const legislative = bill.kind === "bill" || bill.kind === "motion";
  const action = nextAction(bill);

  return (
    <>
      <Titlebar title={bill.number} onClose={onClose} />
      <div className={styles.body}>
        <div className={styles.tags}>
          <span className={styles.tag} data-status={bill.status}>
            <GlossaryText>{bill.statusLabel}</GlossaryText>
          </span>
          {bill.topics.map((topic) => (
            <span key={topic} className={styles.topic}>
              {topic}
            </span>
          ))}
        </div>

        <h2 className={styles.title}>{textStyle === "plain" ? bill.title : bill.officialTitle}</h2>
        {textStyle === "plain" && bill.officialTitle !== bill.title && (
          <p className={styles.updated}>Official title: {bill.officialTitle}</p>
        )}
        {bill.kind === "bill" && bill.updated && <p className={styles.updated}>Last activity {bill.updated}</p>}

        {bill.facts.length > 0 && (
          <dl className={styles.facts}>
            {bill.facts.map((fact) => (
              <div key={fact.label} style={{ display: "contents" }}>
                <dt>{fact.label}</dt>
                <dd>
                  <GlossaryText>{fact.value}</GlossaryText>
                </dd>
              </div>
            ))}
          </dl>
        )}

        {action && (
          <a className={styles.action} href={bill.sourceUrl} target="_blank" rel="noreferrer">
            {action}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        )}

        {(legislative || summary) && (
          <section className={styles.section}>
            <p className={styles.label}>{textStyle === "plain" ? COPY[bill.kind].about : "Official summary"}</p>
            {summary ? (
              <p className={styles.text}>
                <GlossaryText>{summary}</GlossaryText>
              </p>
            ) : (
              <p className={styles.muted}>
                {textStyle === "plain"
                  ? "A plain-English summary isn't ready yet. See the official text below."
                  : "See the official text below."}
              </p>
            )}
          </section>
        )}

        {bill.impact && (
          <section className={`${styles.section} ${styles.impact}`}>
            <p className={styles.label}>How it might affect you</p>
            <p className={styles.text}>
              <GlossaryText>{bill.impact}</GlossaryText>
            </p>
          </section>
        )}

        {legislative && (
          <section className={styles.section}>
            <p className={styles.label}>How {role.short === "CLR" ? "your councillor" : `your ${role.short}`} voted</p>
            {bill.repVote ? (
              <div className={styles.vote}>
                <b data-vote={bill.repVote}>{VOTE_LABEL[bill.repVote]}</b>
                <span>
                  <GlossaryText>{voteNote(bill.repVote, bill)}</GlossaryText>
                </span>
              </div>
            ) : (
              <p className={styles.muted}>
                {bill.votesByRiding ? "Shows once your riding is found." : "Voting records for this level aren't loaded yet."}
              </p>
            )}
          </section>
        )}

        <section className={styles.section}>
          <p className={styles.label}>Progress</p>
          <ol className={styles.stages}>
            {bill.stages.map((stage, index) => {
              const current = stage.done && !bill.stages[index + 1]?.done;
              return (
                <li key={stage.label} data-done={stage.done} data-current={current}>
                  <GlossaryText>{stage.label}</GlossaryText>
                </li>
              );
            })}
          </ol>
        </section>

        {legislative && (
          <section className={styles.section}>
            <p className={styles.label}>
              <GlossaryText>Lobbying</GlossaryText> · {totalMeetings} meeting{totalMeetings === 1 ? "" : "s"}
            </p>
            {bill.lobbying.length === 0 ? (
              <p className={styles.muted}>No registered lobbying on this yet.</p>
            ) : (
              <ul className={styles.lobby}>
                {bill.lobbying.map((item) => (
                  <li key={item.group}>
                    <span className={styles.lobbyName}>{item.group}</span>
                    <span className={styles.bar} aria-hidden="true">
                      <i style={{ width: `${(item.meetings / maxMeetings) * 100}%` }} />
                    </span>
                    <span className={styles.lobbyCount}>{item.meetings}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* The action button already links to the source. */}
        {!action && (
          <a className={styles.source} href={bill.sourceUrl} target="_blank" rel="noreferrer">
            {COPY[bill.kind].source}
          </a>
        )}
      </div>
    </>
  );
}

export function RepDetail({
  role,
  rep,
  bills,
  onOpenBill,
  onClose,
}: {
  role: Role;
  rep?: Representative;
  bills: Bill[];
  onOpenBill: (id: string) => void;
  onClose: () => void;
}) {
  const voted = bills.filter((bill) => bill.repVote && bill.repVote !== "none");
  const yes = voted.filter((bill) => bill.repVote === "yes").length;
  const no = voted.filter((bill) => bill.repVote === "no").length;

  return (
    <>
      <Titlebar title={role.role} onClose={onClose} />
      <div className={styles.body}>
        <div className={styles.repHead}>
          <span className={styles.avatar} aria-hidden="true">
            {role.short}
          </span>
          <div>
            <h2 className={styles.title}>{rep?.name ?? "Not loaded yet"}</h2>
            <p className={styles.updated}>
              {rep
                ? [rep.district, rep.party].filter(Boolean).join(" · ")
                : "Shows once the ward lookup is connected"}
            </p>
          </div>
        </div>

        {(rep?.email || rep?.phone) && (
          <section className={styles.section}>
            <p className={styles.label}>Contact</p>
            {rep.phone && <p className={styles.text}>{rep.phone}</p>}
            {rep.email && (
              <a className={styles.source} href={`mailto:${rep.email}`}>
                Email {rep.name}
              </a>
            )}
          </section>
        )}

        <div className={styles.stats}>
          <div>
            <b>{voted.length}</b>
            <span>votes on these bills</span>
          </div>
          <div>
            <b>{yes}</b>
            <span>voted yes</span>
          </div>
          <div>
            <b>{no}</b>
            <span>voted no</span>
          </div>
        </div>

        <section className={styles.section}>
          <p className={styles.label}>Voting record</p>
          {voted.length === 0 && (
            <p className={styles.muted}>
              {rep ? "No recorded votes on these bills yet." : "Shows once the ward lookup is connected."}
            </p>
          )}
          <ul className={styles.record}>
            {voted.map((bill) => (
              <li key={bill.id}>
                <button type="button" onClick={() => onOpenBill(bill.id)}>
                  <span className={styles.recordTitle}>
                    <span>{bill.number}</span>
                    {bill.title}
                  </span>
                  {bill.repVote && <b data-vote={bill.repVote}>{VOTE_LABEL[bill.repVote]}</b>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}