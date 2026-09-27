"use client";

import { useEffect, useRef, useState } from "react";
import {
  PROFILE_QUESTIONS,
  loadProfile,
  saveProfile,
  toggleMulti,
  type ProfileAnswers,
  type UserProfile,
} from "@/lib/profile";
import { announcePopupOpen, onOtherPopupOpen } from "@/lib/popups";
import styles from "@/modules/Profile.module.css";

type View = "menu" | "quiz";

export default function Profile({ placement = "corner" }: { placement?: "corner" | "map" }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileAnswers>({});
  const [justSaved, setJustSaved] = useState(false);
  const questionRef = useRef<HTMLHeadingElement>(null);

  // localStorage only exists in the browser, so read it after the first render.
  useEffect(() => setProfile(loadProfile()), []);

  useEffect(() => onOtherPopupOpen("profile", close), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (view === "quiz") questionRef.current?.focus();
  }, [view, step]);

  function close() {
    setOpen(false);
    setView("menu");
    setJustSaved(false);
  }

  function startQuiz() {
    const { personalizationEnabled: _enabled, ...answers } = profile ?? { personalizationEnabled: true };
    setDraft(answers);
    setStep(0);
    setJustSaved(false);
    setView("quiz");
  }

  function update(next: UserProfile) {
    setProfile(next);
    saveProfile(next);
  }

  function finish() {
    update({ ...draft, personalizationEnabled: profile?.personalizationEnabled ?? true });
    setJustSaved(true);
    setView("menu");
  }

  function setPersonalization(enabled: boolean) {
    if (profile) update({ ...profile, personalizationEnabled: enabled });
  }

  const question = PROFILE_QUESTIONS[step];
  const isLast = step === PROFILE_QUESTIONS.length - 1;
  const selected = question.multiple ? (draft.familySituation ?? []) : draft[question.key];
  const answered = question.multiple ? (selected as string[]).length > 0 : Boolean(selected);

  const title = view === "quiz" ? (profile ? "Edit Profile" : "Personalize") : profile ? "Your Profile" : "Personalize";

  return (
    <div className={styles.root} data-placement={placement}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={profile ? "Your profile" : "Personalize"}
        aria-expanded={open}
        aria-controls="profile-panel"
        onClick={() => {
          if (open) return close();
          announcePopupOpen("profile");
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.8" />
          <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
        </svg>
        {profile && (
          <span
            className={styles.dot}
            data-enabled={profile.personalizationEnabled}
            aria-hidden="true"
          />
        )}
      </button>

      {open && (
        <aside
          id="profile-panel"
          className={styles.panel}
          role="dialog"
          aria-labelledby="profile-title"
        >
          <div className={styles.titlebar}>
            <span id="profile-title" className={styles.windowTitle}>
              {title}
            </span>
            {view === "quiz" && (
              <span className={styles.progress}>
                {step + 1} / {PROFILE_QUESTIONS.length}
              </span>
            )}
          </div>

          {view === "menu" && !profile && (
            <div className={styles.body}>
              <p className={styles.text}>
                Tell us a little about yourself to see bills that may be more relevant to you.
              </p>
              <button type="button" className={styles.primary} onClick={startQuiz}>
                Get Started
              </button>
            </div>
          )}

          {view === "menu" && profile && (
            <div className={styles.body}>
              {justSaved && (
                <p className={styles.saved} role="status">
                  Profile saved.
                </p>
              )}
              <div className={styles.toggleRow}>
                <span id="personalization-label" className={styles.toggleLabel}>
                  Personalization
                </span>
                <button
                  type="button"
                  role="switch"
                  className={styles.switch}
                  aria-checked={profile.personalizationEnabled}
                  aria-labelledby="personalization-label"
                  onClick={() => setPersonalization(!profile.personalizationEnabled)}
                >
                  <span className={styles.switchText}>
                    {profile.personalizationEnabled ? "ON" : "OFF"}
                  </span>
                </button>
              </div>
              <button type="button" className={styles.primary} onClick={startQuiz}>
                Edit Profile
              </button>
              <p className={styles.note}>
                {profile.personalizationEnabled
                  ? "Your profile helps personalize the bills you see."
                  : "Your profile is saved. Turn personalization on to use it again."}
              </p>
            </div>
          )}

          {view === "quiz" && (
            <form
              className={styles.body}
              onSubmit={(event) => {
                event.preventDefault();
                if (!answered) return;
                if (isLast) finish();
                else setStep(step + 1);
              }}
            >
              <div
                className={styles.fieldset}
                role={question.multiple ? "group" : "radiogroup"}
                aria-labelledby="profile-question"
              >
                <h2 id="profile-question" ref={questionRef} tabIndex={-1} className={styles.question}>
                  {question.prompt}
                </h2>
                {question.multiple && <p className={styles.hint}>Select all that apply.</p>}
                <div className={styles.options}>
                  {question.options.map((option) => {
                    const checked = question.multiple
                      ? (selected as string[]).includes(option.value)
                      : selected === option.value;
                    return (
                      <label key={option.value} className={styles.option} data-checked={checked}>
                        <input
                          type={question.multiple ? "checkbox" : "radio"}
                          name={question.key}
                          value={option.value}
                          checked={checked}
                          onChange={() =>
                            setDraft((current) =>
                              question.multiple
                                ? {
                                    ...current,
                                    familySituation: toggleMulti(
                                      question,
                                      current.familySituation ?? [],
                                      option.value
                                    ),
                                  }
                                : { ...current, [question.key]: option.value }
                            )
                          }
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className={styles.nav}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => (step === 0 ? setView("menu") : setStep(step - 1))}
                >
                  ← Back
                </button>
                <button type="submit" className={styles.primary} disabled={!answered}>
                  {isLast ? "Save Profile" : "Next →"}
                </button>
              </div>
            </form>
          )}
        </aside>
      )}
    </div>
  );
}
