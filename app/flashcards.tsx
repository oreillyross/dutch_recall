"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { InsightError, fetchDutchDescription, fetchInsight } from "@/lib/insight-client";
import type { DutchDescription, Insight } from "@/lib/schema";
import { getSession, lock, unlock, type SessionState } from "@/lib/session-client";
import { BUILD } from "@/lib/build-info";
import { APP_NAME, MESSAGES, type Messages, type UiLang } from "@/lib/i18n";
import { KEYS, getItem, removeItem, setItem } from "@/lib/storage";
import { emptyUsage, recordCall, recordError, type UsageTotals } from "@/lib/usage";
import { parseWords, shuffled } from "@/lib/words";

type Tab = "cards" | "settings" | "usage";
type BackLang = UiLang;
type BackState<T = Insight> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; needsAccess?: boolean }
  | { status: "ok"; data: T };

export default function Flashcards() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("cards");
  const [raw, setRaw] = useState(""); // saved words, newline-separated
  const [draft, setDraft] = useState(""); // new words typed but not yet saved
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [shuffleOn, setShuffleOn] = useState(true);
  const [deck, setDeck] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [session, setSession] = useState<SessionState | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [sessionMsg, setSessionMsg] = useState("");
  const [descriptions, setDescriptions] = useState<Record<string, DutchDescription>>({});
  const [backLang, setBackLang] = useState<BackLang>("en"); // saved UI + card-back language
  const [pendingLang, setPendingLang] = useState<BackLang>("en"); // staged in Settings until "Save settings"
  const [pendingShuffle, setPendingShuffle] = useState(true);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [usage, setUsage] = useState<UsageTotals>(emptyUsage);
  const [flipped, setFlipped] = useState(false);
  const [fetchState, setFetchState] = useState<BackState<never>>({ status: "idle" });

  const reqId = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage (client only).
  useEffect(() => {
    const d = getItem<string[]>(KEYS.deck, []);
    const i = Math.min(getItem<number>(KEYS.index, 0), Math.max(d.length - 1, 0));
    /* eslint-disable react-hooks/set-state-in-effect */
    setRaw(getItem<string>(KEYS.raw, ""));
    const sh = getItem<boolean>(KEYS.shuffle, true);
    setShuffleOn(sh);
    setPendingShuffle(sh);
    setDeck(d);
    setIndex(i);
    setInsights(getItem<Record<string, Insight>>(KEYS.insights, {}));
    setDescriptions(getItem<Record<string, DutchDescription>>(KEYS.descriptions, {}));
    const lang: BackLang = getItem<BackLang>(KEYS.backLang, "en") === "nl" ? "nl" : "en";
    setBackLang(lang);
    setPendingLang(lang);
    removeItem(KEYS.access); // legacy plaintext access code from older versions
    setUsage(getItem<UsageTotals>(KEYS.usage, emptyUsage()));
    if (!d.length) setTab("settings");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const t = MESSAGES[backLang];

  // Keep the tab title and <html lang> in the chosen language.
  useEffect(() => {
    document.title = `${APP_NAME} · ${t.deckName}`;
    document.documentElement.lang = t.locale;
  }, [t]);

  const word = deck[index];
  const cached = word ? insights[word.toLowerCase()] : undefined;
  const cachedNl = word ? descriptions[word.toLowerCase()] : undefined;
  const back: BackState = cached ? { status: "ok", data: cached } : fetchState;
  const backNl: BackState<DutchDescription> = cachedNl ? { status: "ok", data: cachedNl } : fetchState;
  const savedWords = parseWords(raw);
  const draftCount = parseWords(draft).length;
  const count = parseWords(`${raw}\n${draft}`).length;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (pendingDelete && !d.open) d.showModal();
    else if (!pendingDelete && d.open) d.close();
  }, [pendingDelete]);

  const showTab = useCallback((t: Tab) => {
    setTab(t);
    if (t === "settings") requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
  }, []);

  const resetCard = useCallback((nextIndex: number) => {
    reqId.current++; // invalidate any in-flight response
    setIndex(nextIndex);
    setFlipped(false);
    setFetchState({ status: "idle" });
    setItem(KEYS.index, nextIndex);
    if (backRef.current) backRef.current.scrollTop = 0;
  }, []);

  const loadInsight = useCallback(
    async (force: boolean, lang: BackLang = backLang) => {
      if (!word) return;
      const key = word.toLowerCase();
      if (!force && (lang === "nl" ? descriptions[key] : insights[key])) return;
      const my = ++reqId.current;
      setFetchState({ status: "loading" });
      try {
        let u;
        if (lang === "nl") {
          const res = await fetchDutchDescription(word);
          u = res.usage;
          setDescriptions((prev) => {
            const next = { ...prev, [key]: res.insight };
            setItem(KEYS.descriptions, next);
            return next;
          });
        } else {
          const res = await fetchInsight(word);
          u = res.usage;
          setInsights((prev) => {
            const next = { ...prev, [key]: res.insight };
            setItem(KEYS.insights, next);
            return next;
          });
        }
        if (u) {
          setUsage((prev) => {
            const next = recordCall(prev, u);
            setItem(KEYS.usage, next);
            return next;
          });
        }
        if (my === reqId.current) setFetchState({ status: "idle" });
      } catch (err) {
        setUsage((prev) => {
          const next = recordError(prev);
          setItem(KEYS.usage, next);
          return next;
        });
        if (my !== reqId.current) return;
        setFetchState({
          status: "error",
          message: err instanceof InsightError ? err.message : MESSAGES[lang].cards.loadFailed,
          needsAccess: err instanceof InsightError && err.status === 401,
        });
      }
    },
    [word, insights, descriptions, backLang],
  );

  const saveSettings = () => {
    const langChanged = pendingLang !== backLang;
    const shuffleChanged = pendingShuffle !== shuffleOn;
    setItem(KEYS.shuffle, pendingShuffle);
    setShuffleOn(pendingShuffle);
    if (langChanged) {
      setBackLang(pendingLang);
      setItem(KEYS.backLang, pendingLang);
      reqId.current++; // drop any in-flight request for the other language
      setFetchState({ status: "idle" });
    }
    if (shuffleChanged) {
      // New order applies to the whole deck, so start again from card 1.
      const nextDeck = pendingShuffle ? shuffled(savedWords) : savedWords;
      setDeck(nextDeck);
      setItem(KEYS.deck, nextDeck);
      resetCard(0);
    } else if (langChanged && flipped) {
      void loadInsight(false, pendingLang);
    }
    setSettingsSaved(true);
  };

  const flip = useCallback(() => {
    if (!deck.length) return;
    if (!flipped) {
      setFlipped(true);
      void loadInsight(false);
    } else {
      setFlipped(false);
    }
  }, [deck.length, flipped, loadInsight]);

  const go = useCallback(
    (delta: number) => {
      const n = index + delta;
      if (n < 0 || n >= deck.length) return;
      resetCard(n);
    },
    [index, deck.length, resetCard],
  );

  const confirmDelete = () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const key = target.toLowerCase();
    const nextSaved = savedWords.filter((w) => w.toLowerCase() !== key).join("\n");
    const nextDeck = deck.filter((w) => w.toLowerCase() !== key);
    setRaw(nextSaved);
    setItem(KEYS.raw, nextSaved);
    setDeck(nextDeck);
    setItem(KEYS.deck, nextDeck);
    resetCard(Math.min(index, Math.max(nextDeck.length - 1, 0)));
  };

  const saveWords = () => {
    const merged = parseWords(`${raw}\n${draft}`);
    const mergedRaw = merged.join("\n");
    const nextDeck = shuffleOn ? shuffled(merged) : merged;
    setRaw(mergedRaw);
    setDraft("");
    setItem(KEYS.raw, mergedRaw);
    setItem(KEYS.deck, nextDeck);
    setDeck(nextDeck);
    resetCard(0);
    setTab("cards");
  };

  // Keyboard: Space flips, arrows navigate (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab !== "cards") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      if (e.key === " " && !(t && t.tagName === "BUTTON")) {
        e.preventDefault();
        flip();
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tab, flip, go]);

  if (!ready) return <div className="app" />;

  const hasDeck = deck.length > 0;
  const long = !!word && (word.length > 22 || word.split(" ").length > 3);

  return (
    <div className="app">
      <header>
        <h1>
          Lang<span>cards</span>
        </h1>
        <nav role="tablist" aria-label={t.tabs.aria}>
          <button role="tab" id="tab-cards" aria-selected={tab === "cards"} aria-controls="panel-cards" onClick={() => showTab("cards")}>
            {t.tabs.cards}
          </button>
          <button role="tab" id="tab-settings" aria-selected={tab === "settings"} aria-controls="panel-settings" onClick={() => showTab("settings")}>
            {t.tabs.words}
          </button>
          <button role="tab" id="tab-usage" aria-selected={tab === "usage"} aria-controls="panel-usage" onClick={() => showTab("usage")}>
            {t.tabs.usage}
          </button>
        </nav>
      </header>

      <section className="panel" id="panel-cards" role="tabpanel" aria-labelledby="tab-cards" hidden={tab !== "cards"}>
        {hasDeck ? (
          <div id="deck">
            <div className="progress">
              <span>
                {t.cards.progress(index + 1, deck.length)}
              </span>
              <div className="bar">
                <i style={{ width: `${((index + 1) / deck.length) * 100}%` }} />
              </div>
            </div>
            <div className="scene">
              <div className={`card${flipped ? " flipped" : ""}`}>
                <div
                  className="face card-front"
                  tabIndex={0}
                  role="button"
                  aria-label={t.cards.flipAria}
                  onClick={flip}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      flip();
                    }
                  }}
                >
                  <span className="tag">{t.targetLanguage}</span>
                  <div className={`word${long ? " long" : ""}`}>{word}</div>
                  <span className="hint">{t.cards.hint}</span>
                </div>
                <div className="face card-back" ref={backRef} aria-live="polite">
                  <span className="tag">{t.cards.backTag}</span>
                  <div className="back-nl">{word}</div>
                  {backLang === "nl" ? (
                    <BackShell t={t} state={backNl} onRetry={() => void loadInsight(true)} onSettings={() => showTab("settings")}>
                      {(d) => (
                        <>
                          <p className="uitleg">{d.uitleg}</p>
                          {d.grammatica?.length > 0 && (
                            <div className="sec">
                              <h3>{t.cards.grammar}</h3>
                              <ul className="gram">
                                {d.grammatica.map((g) => (
                                  <li key={g.woord}>
                                    <b>{g.woord}</b> <span>{g.soort}</span>
                                    {g.details && <span> · {g.details}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </BackShell>
                  ) : (
                    <BackShell t={t} state={back} onRetry={() => void loadInsight(true)} onSettings={() => showTab("settings")}>
                      {(d) => <EnglishBody d={d} t={t} />}
                    </BackShell>
                  )}
                </div>
              </div>
            </div>
            <div className="controls">
              <button className="btn" onClick={() => go(-1)} disabled={index === 0}>
                {t.cards.prev}
              </button>
              <button className="btn primary" onClick={flip}>
                {flipped ? t.cards.flipBack : t.cards.flip}
              </button>
              <button className="btn" onClick={() => go(1)} disabled={index === deck.length - 1}>
                {t.cards.next}
              </button>
            </div>
            <div className="kbd">{t.cards.keys}</div>
          </div>
        ) : (
          <div className="empty">
            <h2>{t.cards.emptyTitle}</h2>
            <p>{t.cards.emptyBody}</p>
            <button className="btn primary" onClick={() => showTab("settings")}>
              {t.cards.openWords}
            </button>
          </div>
        )}
      </section>

      <section className="panel settings" id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden={tab !== "settings"}>
        <label className="title" htmlFor="words">
          {t.words.title}
        </label>
        <p className="help">{t.words.help}</p>
        {savedWords.length > 0 && (
          <ul className="pills" aria-label={t.words.savedAria}>
            {savedWords.map((w) => (
              <li key={w} className="pill">
                <span>{w}</span>
                <button type="button" aria-label={t.words.removeAria(w)} onClick={() => setPendingDelete(w)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          id="words"
          ref={textareaRef}
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={savedWords.length ? t.words.placeholderMore : t.words.placeholderFirst}
        />
        <div className="row">
          <span className="count">{t.words.count(count)}</span>
          <span className="spacer" />
          {draftCount > 0 && (
            <button
              className="btn ghost"
              onClick={() => {
                setDraft("");
                textareaRef.current?.focus();
              }}
            >
              {t.words.clearNew}
            </button>
          )}
          <button className="btn primary" onClick={saveWords}>
            {t.words.save}
          </button>
        </div>

        <h2 className="section-title">{t.settings.title}</h2>
        {session?.required && (
          <>
            <label className="title access" htmlFor="access">
              {t.settings.accessCode}
            </label>
            {session.unlocked ? (
              <div className="row">
                <span className="count">{t.settings.unlocked}</span>
                <span className="spacer" />
                <button
                  className="btn ghost"
                  onClick={() => {
                    setSessionMsg("");
                    lock().then(setSession, (e: Error) => setSessionMsg(e.message));
                  }}
                >
                  {t.settings.lock}
                </button>
              </div>
            ) : (
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSessionMsg("");
                  unlock(codeInput).then(
                    (s) => {
                      setCodeInput("");
                      setSession(s);
                    },
                    (err: Error) => setSessionMsg(err.message),
                  );
                }}
              >
                <input
                  id="access"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder={t.settings.accessPlaceholder}
                />
                <button className="btn primary" type="submit" disabled={!codeInput}>
                  {t.settings.unlock}
                </button>
              </form>
            )}
            {sessionMsg && <p className="help" role="alert">{sessionMsg}</p>}
          </>
        )}
        <div className="row backlang" role="radiogroup" aria-label={t.settings.language}>
          <span className="title">{t.settings.language}</span>
          <label className="check">
            <input
              type="radio"
              name="backlang"
              checked={pendingLang === "en"}
              onChange={() => {
                setPendingLang("en");
                setSettingsSaved(false);
              }}
            />{" "}
            {t.settings.optionEn}
          </label>
          <label className="check">
            <input
              type="radio"
              name="backlang"
              checked={pendingLang === "nl"}
              onChange={() => {
                setPendingLang("nl");
                setSettingsSaved(false);
              }}
            />{" "}
            {t.settings.optionNl}
          </label>
        </div>
        <p className="help">{t.settings.languageHelp}</p>
        <div className="row">
          <label className="check">
            <input
              type="checkbox"
              checked={pendingShuffle}
              onChange={(e) => {
                setPendingShuffle(e.target.checked);
                setSettingsSaved(false);
              }}
            />{" "}
            {t.settings.shuffle}
          </label>
          <span className="spacer" />
          {settingsSaved && (
            <span className="count" role="status">
              {t.settings.saved}
            </span>
          )}
          <button className="btn primary" onClick={saveSettings}>
            {t.settings.save}
          </button>
        </div>
      </section>

      <dialog ref={dialogRef} className="confirm" onClose={() => setPendingDelete(null)}>
        <p>
          {pendingDelete && t.words.confirmRemove(pendingDelete)}
        </p>
        <div className="row">
          <span className="spacer" />
          <button className="btn ghost" autoFocus onClick={() => setPendingDelete(null)}>
            {t.words.cancel}
          </button>
          <button className="btn primary" onClick={confirmDelete}>
            {t.words.remove}
          </button>
        </div>
      </dialog>

      <section className="panel" id="panel-usage" role="tabpanel" aria-labelledby="tab-usage" hidden={tab !== "usage"}>
        <UsagePanel
          t={t}
          usage={usage}
          onReset={() => {
            const e = emptyUsage();
            setUsage(e);
            setItem(KEYS.usage, e);
          }}
        />
      </section>
    </div>
  );
}

function fmtCost(n: number) {
  return n > 0 && n < 0.0001 ? "<$0.0001" : `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

function UsagePanel({ t, usage, onReset }: { t: Messages; usage: UsageTotals; onReset: () => void }) {
  const models = Object.entries(usage.byModel);
  const published = BUILD.time ? new Date(BUILD.time).toLocaleString(t.locale, { dateStyle: "medium", timeStyle: "short" }) : t.usage.unknown;
  const version = [BUILD.ref, BUILD.sha && BUILD.sha !== BUILD.ref ? `(${BUILD.sha})` : ""].filter(Boolean).join(" ") || t.usage.unknown;
  return (
    <div className="usage">
      <dl className="build">
        <div><dt>{t.usage.version}</dt><dd>{version}</dd></div>
        <div><dt>{t.usage.published}</dt><dd>{published}</dd></div>
      </dl>
      <p className="help">{t.usage.help}</p>
      <div className="stats">
        <div><b>{usage.calls}</b><span>{t.usage.calls}</span></div>
        <div><b>{usage.inputTokens.toLocaleString()}</b><span>{t.usage.inputTokens}</span></div>
        <div><b>{usage.outputTokens.toLocaleString()}</b><span>{t.usage.outputTokens}</span></div>
        <div><b>{fmtCost(usage.costUSD)}</b><span>{t.usage.estCost(usage.unpriced > 0)}</span></div>
      </div>
      {usage.errors > 0 && <p className="help">{t.usage.failed(usage.errors)}</p>}
      {models.length > 0 && (
        <table className="usage-table">
          <thead>
            <tr><th>{t.usage.model}</th><th>{t.usage.callsShort}</th><th>{t.usage.in}</th><th>{t.usage.out}</th><th>{t.usage.cost}</th></tr>
          </thead>
          <tbody>
            {models.map(([m, v]) => (
              <tr key={m}>
                <td>{m}</td><td>{v.calls}</td><td>{v.inputTokens.toLocaleString()}</td><td>{v.outputTokens.toLocaleString()}</td><td>{fmtCost(v.costUSD)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row">
        <span className="count">{t.usage.since(new Date(usage.since).toLocaleDateString(t.locale))}</span>
        <span className="spacer" />
        <button className="btn ghost" onClick={onReset}>{t.usage.reset}</button>
      </div>
    </div>
  );
}

function BackShell<T>({
  t,
  state,
  onRetry,
  onSettings,
  children,
}: {
  t: Messages;
  state: BackState<T>;
  onRetry: () => void;
  onSettings: () => void;
  children: (data: T) => React.ReactNode;
}) {
  if (state.status === "loading")
    return (
      <div className="loading">
        <div className="spin" />
        <span>{t.cards.loading}</span>
      </div>
    );
  if (state.status === "error")
    return (
      <div className="err">
        {state.message}
        <br />
        {state.needsAccess && (
          <button className="btn small" onClick={onSettings}>
            {t.cards.openWords}
          </button>
        )}{" "}
        <button className="btn small" onClick={onRetry}>
          {t.cards.retry}
        </button>
      </div>
    );
  if (state.status !== "ok") return null;
  return <>{children(state.data)}</>;
}

function EnglishBody({ d, t }: { d: Insight; t: Messages }) {
  return (
    <>
      <div className="back-en">{d.english[0] || "—"}</div>
      {d.english.length > 1 && <div className="alts">{t.cards.alsoLabel} {d.english.slice(1).join(" · ")}</div>}
      {(d.pos || d.forms || d.pronunciation) && (
        <div className="chips">
          {d.pos && <span className="chip hi">{d.pos}</span>}
          {d.forms && <span className="chip">{d.forms}</span>}
          {d.pronunciation && <span className="chip">🔊 {d.pronunciation}</span>}
        </div>
      )}
      {d.examples.length > 0 && (
        <div className="sec">
          <h3>{t.cards.inUse}</h3>
          {d.examples.map((x, i) => (
            <div className="ex" key={i}>
              <div className="nl">{x.nl}</div>
              <div className="en">{x.en}</div>
            </div>
          ))}
        </div>
      )}
      {d.notes && (
        <div className="sec">
          <h3>{t.cards.goodToKnow}</h3>
          <p>{d.notes}</p>
        </div>
      )}
      {d.related.length > 0 && (
        <div className="sec">
          <h3>{t.cards.related}</h3>
          <div className="rel">
            {d.related.map((r, i) => (
              <Fragment key={i}>
                <b>{r.nl}</b>
                <span>{r.en}</span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
