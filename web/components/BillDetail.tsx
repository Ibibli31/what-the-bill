"use client";

import type { Bill } from "@/data/sampleBills";
import type { Representative, TextStyle } from "@/components/Sidebar";
import styles from "@/modules/BillDetail.module.css";

type Role = { role: string; short: string; label: string };

const VOTE_LABEL = { yes: "Yes", no: "No", none: "No vote yet" } as const;

function Titlebar({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className={styles.titlebar}>
      {/* Phones/tablets: the details cover the list, so this reads as "back" */}
      <button type="button" className={styles.back} onClick={onClose}>
        &lt; back
      </button>
      <span className={styles.windowTitle}>{title}</span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close details">
        [ × ]
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

  return (
    <>
      <Titlebar title={bill.number} onClose={onClose} />
      <div className={styles.body}>
        <div className={styles.tags}>
          <span className={styles.tag} data-status={bill.status}>
            {bill.status}
          </span>
          {bill.topics.map((topic) => (
            <span key={topic} className={styles.topic}>
              {topic}
            </span>
          ))}
        </div>

        <h2 className={styles.title}>{bill.title}</h2>
        <p className={styles.updated}>Last activity {bill.updated}</p>

        <section className={styles.section}>
          <p className={styles.label}>{textStyle === "plain" ? "What it does" : "Official summary"}</p>
          <p className={styles.text}>{textStyle === "plain" ? bill.summary : bill.officialSummary}</p>
        </section>

        <section className={`${styles.section} ${styles.impact}`}>
          <p className={styles.label}>How it might affect you</p>
          <p className={styles.text}>{bill.impact}</p>
        </section>

        <section className={styles.section}>
          <p className={styles.label}>How {role.short === "CLR" ? "your councillor" : `your ${role.short}`} voted</p>
          <div className={styles.vote}>
            <b data-vote={bill.repVote}>{VOTE_LABEL[bill.repVote]}</b>
            <span>
              {bill.repVote === "none"
                ? "This hasn't come to a vote yet."
                : `Recorded vote at ${bill.status === "Passed" || bill.status === "Defeated" ? "the final" : "the latest"} stage.`}
            </span>
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.label}>Progress</p>
          <ol className={styles.stages}>
            {bill.stages.map((stage, index) => {
              const current = stage.done && !bill.stages[index + 1]?.done;
              return (
                <li key={stage.label} data-done={stage.done} data-current={current}>
                  {stage.label}
                </li>
              );
            })}
          </ol>
        </section>

        <section className={styles.section}>
          <p className={styles.label}>
            Lobbying · {totalMeetings} meeting{totalMeetings === 1 ? "" : "s"}
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

        <a className={styles.source} href={bill.sourceUrl} target="_blank" rel="noreferrer">
          [ Read the official text ]
        </a>
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
  const voted = bills.filter((bill) => bill.repVote !== "none");
  const yes = voted.filter((bill) => bill.repVote === "yes").length;

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
                [ Email {rep.name} ]
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
            <b>{voted.length - yes}</b>
            <span>voted no</span>
          </div>
        </div>

        <section className={styles.section}>
          <p className={styles.label}>Voting record</p>
          <ul className={styles.record}>
            {bills.map((bill) => (
              <li key={bill.id}>
                <button type="button" onClick={() => onOpenBill(bill.id)}>
                  <span className={styles.recordTitle}>
                    <span>{bill.number}</span>
                    {bill.title}
                  </span>
                  <b data-vote={bill.repVote}>{VOTE_LABEL[bill.repVote]}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}