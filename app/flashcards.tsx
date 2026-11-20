"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { InsightError, fetchDutchDescription, fetchInsight } from "@/lib/insight-client";
import type { DutchDescription, Insight } from "@/lib/schema";
import { getSession, lock, unlock, type SessionState } from "@/lib/session-client";
import { KEYS, getItem, removeItem, setItem } from "@/lib/storage";
import { emptyUsage, recordCall, recordError, type UsageTotals } from "@/lib/usage";
import { parseWords, shuffled } from "@/lib/words";

type Tab = "cards" | "settings" | "usage";
type BackLang = "en" | "nl";
type BackState<T = Insight> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; needsAccess?: boolean }
  | { status: "ok"; data: T };

export default function Flashcards() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("cards");
  const [raw, setRaw] = useState("");
  const [shuffleOn, setShuffleOn] = useState(true);
  const [deck, setDeck] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [insights, setInsights] = useState<Record<string, Insight>>({});
  const [session, setSession] = useState<SessionState | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [sessionMsg, setSessionMsg] = useState("");
  const [descriptions, setDescriptions] = useState<Record<string, DutchDescription>>({});
  const [backLang, setBackLang] = useState<BackLang>("en");
  const [usage, setUsage] = useState<UsageTotals>(emptyUsage);
  const [flipped, setFlipped] = useState(false);
  const [fetchState, setFetchState] = useState<BackState<never>>({ status: "idle" });

  const reqId = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage (client only).
  useEffect(() => {
    const d = getItem<string[]>(KEYS.deck, []);
    const i = Math.min(getItem<number>(KEYS.index, 0), Math.max(d.length - 1, 0));
    /* eslint-disable react-hooks/set-state-in-effect */
    setRaw(getItem<string>(KEYS.raw, ""));
    setShuffleOn(getItem<boolean>(KEYS.shuffle, true));
    setDeck(d);
    setIndex(i);
    setInsights(getItem<Record<string, Insight>>(KEYS.insights, {}));
    setDescriptions(getItem<Record<string, DutchDescription>>(KEYS.descriptions, {}));
    setBackLang(getItem<BackLang>(KEYS.backLang, "en") === "nl" ? "nl" : "en");
    removeItem(KEYS.access); // legacy plaintext access code from older versions
    setUsage(getItem<UsageTotals>(KEYS.usage, emptyUsage()));
    if (!d.length) setTab("settings");
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    getSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  const word = deck[index];
  const cached = word ? insights[word.toLowerCase()] : undefined;
  const cachedNl = word ? descriptions[word.toLowerCase()] : undefined;
  const back: BackState = cached ? { status: "ok", data: cached } : fetchState;
  const backNl: BackState<DutchDescription> = cachedNl ? { status: "ok", data: cachedNl } : fetchState;
  const count = parseWords(raw).length;

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
          message: err instanceof InsightError ? err.message : "Could not load the insight. Try again.",
          needsAccess: err instanceof InsightError && err.status === 401,
        });
      }
    },
    [word, insights, descriptions, backLang],
  );

  const changeBackLang = (lang: BackLang) => {
    if (lang === backLang) return;
    setBackLang(lang);
    setItem(KEYS.backLang, lang);
    reqId.current++; // drop any in-flight request for the other language
    setFetchState({ status: "idle" });
    if (flipped) void loadInsight(false, lang);
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

  const save = () => {
    const list = parseWords(raw);
    const nextDeck = shuffleOn ? shuffled(list) : list;
    setItem(KEYS.raw, raw);
    setItem(KEYS.shuffle, shuffleOn);
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
          Nederlands <span>kaartjes</span>
        </h1>
        <nav role="tablist" aria-label="Sections">
          <button role="tab" id="tab-cards" aria-selected={tab === "cards"} aria-controls="panel-cards" onClick={() => showTab("cards")}>
            Cards
          </button>
          <button role="tab" id="tab-settings" aria-selected={tab === "settings"} aria-controls="panel-settings" onClick={() => showTab("settings")}>
            Settings
          </button>
          <button role="tab" id="tab-usage" aria-selected={tab === "usage"} aria-controls="panel-usage" onClick={() => showTab("usage")}>
            Usage
          </button>
        </nav>
      </header>

      <section className="panel" id="panel-cards" role="tabpanel" aria-labelledby="tab-cards" hidden={tab !== "cards"}>
        {hasDeck ? (
          <div id="deck">
            <div className="progress">
              <span>
                {index + 1} / {deck.length}
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
                  aria-label="Flip card"
                  onClick={flip}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      flip();
                    }
                  }}
                >
                  <span className="tag">Nederlands</span>
                  <div className={`word${long ? " long" : ""}`}>{word}</div>
                  <span className="hint">{backLang === "nl" ? "Probeer het uit te leggen, tik dan om te draaien" : "Guess the English, then tap to flip"}</span>
                </div>
                <div className="face card-back" ref={backRef} aria-live="polite">
                  <span className="tag">{backLang === "nl" ? "Uitleg" : "English"}</span>
                  <div className="back-nl">{word}</div>
                  {backLang === "nl" ? (
                    <BackShell state={backNl} onRetry={() => void loadInsight(true)} onSettings={() => showTab("settings")}>
                      {(d) => <p className="uitleg">{d.uitleg}</p>}
                    </BackShell>
                  ) : (
                    <BackShell state={back} onRetry={() => void loadInsight(true)} onSettings={() => showTab("settings")}>
                      {(d) => <EnglishBody d={d} />}
                    </BackShell>
                  )}
                </div>
              </div>
            </div>
            <div className="controls">
              <button className="btn" onClick={() => go(-1)} disabled={index === 0}>
                ← Prev
              </button>
              <button className="btn primary" onClick={flip}>
                {flipped ? "Flip back" : "Flip"}
              </button>
              <button className="btn" onClick={() => go(1)} disabled={index === deck.length - 1}>
                Next →
              </button>
            </div>
            <div className="kbd">Space flips · ← → moves between cards</div>
          </div>
        ) : (
          <div className="empty">
            <h2>No words yet</h2>
            <p>Paste some Dutch words or phrases in Settings.</p>
            <button className="btn primary" onClick={() => showTab("settings")}>
              Open Settings
            </button>
          </div>
        )}
      </section>

      <section className="panel settings" id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" hidden={tab !== "settings"}>
        <label className="title" htmlFor="words">
          Your Dutch words
        </label>
        <p className="help">One word or phrase per line. Duplicates and blank lines are ignored. Saving refreshes the flashcards.</p>
        <textarea
          id="words"
          ref={textareaRef}
          spellCheck={false}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"gezellig\naan de slag gaan\nuitzoeken\nde fiets\nhet is niet mijn pakkie-an"}
        />
        {session?.required && (
          <>
            <label className="title access" htmlFor="access">
              Access code
            </label>
            {session.unlocked ? (
              <div className="row">
                <span className="count">Unlocked on this browser.</span>
                <span className="spacer" />
                <button
                  className="btn ghost"
                  onClick={() => {
                    setSessionMsg("");
                    lock().then(setSession, (e: Error) => setSessionMsg(e.message));
                  }}
                >
                  Lock
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
                  placeholder="Needed to use this site"
                />
                <button className="btn primary" type="submit" disabled={!codeInput}>
                  Unlock
                </button>
              </form>
            )}
            {sessionMsg && <p className="help" role="alert">{sessionMsg}</p>}
          </>
        )}
        <div className="row backlang" role="radiogroup" aria-label="Card back language">
          <span className="title">Card back</span>
          <label className="check">
            <input type="radio" name="backlang" checked={backLang === "en"} onChange={() => changeBackLang("en")} /> English description
          </label>
          <label className="check">
            <input type="radio" name="backlang" checked={backLang === "nl"} onChange={() => changeBackLang("nl")} /> Dutch description
            (groep 7/8)
          </label>
        </div>
        <div className="row">
          <span className="count">
            {count} {count === 1 ? "word" : "words"}
          </span>
          <label className="check">
            <input type="checkbox" checked={shuffleOn} onChange={(e) => setShuffleOn(e.target.checked)} /> Shuffle order
          </label>
          <span className="spacer" />
          <button
            className="btn ghost"
            onClick={() => {
              setRaw("");
              textareaRef.current?.focus();
            }}
          >
            Clear
          </button>
          <button className="btn primary" onClick={save}>
            Save &amp; refresh cards
          </button>
        </div>
      </section>

      <section className="panel" id="panel-usage" role="tabpanel" aria-labelledby="tab-usage" hidden={tab !== "usage"}>
        <UsagePanel
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

function UsagePanel({ usage, onReset }: { usage: UsageTotals; onReset: () => void }) {
  const models = Object.entries(usage.byModel);
  return (
    <div className="usage">
      <p className="help">
        Tokens and estimated cost of insight lookups from this browser. Cached cards cost nothing. Estimates use list prices.
      </p>
      <div className="stats">
        <div><b>{usage.calls}</b><span>LLM calls</span></div>
        <div><b>{usage.inputTokens.toLocaleString()}</b><span>input tokens</span></div>
        <div><b>{usage.outputTokens.toLocaleString()}</b><span>output tokens</span></div>
        <div><b>{fmtCost(usage.costUSD)}</b><span>est. cost{usage.unpriced ? " (partial)" : ""}</span></div>
      </div>
      {usage.errors > 0 && (
        <p className="help">
          {usage.errors} failed {usage.errors === 1 ? "request" : "requests"}.
        </p>
      )}
      {models.length > 0 && (
        <table className="usage-table">
          <thead>
            <tr><th>Model</th><th>Calls</th><th>In</th><th>Out</th><th>Cost</th></tr>
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
        <span className="count">Since {new Date(usage.since).toLocaleDateString()}</span>
        <span className="spacer" />
        <button className="btn ghost" onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}

function BackShell<T>({
  state,
  onRetry,
  onSettings,
  children,
}: {
  state: BackState<T>;
  onRetry: () => void;
  onSettings: () => void;
  children: (data: T) => React.ReactNode;
}) {
  if (state.status === "loading")
    return (
      <div className="loading">
        <div className="spin" />
        <span>Looking it up…</span>
      </div>
    );
  if (state.status === "error")
    return (
      <div className="err">
        {state.message}
        <br />
        {state.needsAccess && (
          <button className="btn small" onClick={onSettings}>
            Open Settings
          </button>
        )}{" "}
        <button className="btn small" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  if (state.status !== "ok") return null;
  return <>{children(state.data)}</>;
}

function EnglishBody({ d }: { d: Insight }) {
  return (
    <>
      <div className="back-en">{d.english[0] || "—"}</div>
      {d.english.length > 1 && <div className="alts">also: {d.english.slice(1).join(" · ")}</div>}
      {(d.pos || d.forms || d.pronunciation) && (
        <div className="chips">
          {d.pos && <span className="chip hi">{d.pos}</span>}
          {d.forms && <span className="chip">{d.forms}</span>}
          {d.pronunciation && <span className="chip">🔊 {d.pronunciation}</span>}
        </div>
      )}
      {d.examples.length > 0 && (
        <div className="sec">
          <h3>In use</h3>
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
          <h3>Good to know</h3>
          <p>{d.notes}</p>
        </div>
      )}
      {d.related.length > 0 && (
        <div className="sec">
          <h3>Related</h3>
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
