"use client";

import { useEffect, useState } from "react";
import { MESSAGES } from "@/lib/i18n";
import { KEYS, getItem } from "@/lib/storage";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "nl_install_dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Registers the service worker and offers an "Add to Home Screen" prompt until installed. */
export default function Pwa() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [lang, setLang] = useState<"en" | "nl">("en");

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLang(getItem<string>(KEYS.backLang, "en") === "nl" ? "nl" : "en");
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch {}
    if (isStandalone() || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => { setDeferred(null); setIosHint(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt; show manual instructions instead.
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    const t = ios ? setTimeout(() => setIosHint(true), 0) : undefined;

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDeferred(null);
    setIosHint(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  if (!deferred && !iosHint) return null;
  const t = MESSAGES[lang].pwa;

  return (
    <div className="install-banner" role="dialog" aria-label={t.installAria}>
      <div className="install-text">
        <strong>{t.installTitle}</strong>
        <span>
          {deferred ? t.installBody : t.iosBody}
        </span>
      </div>
      {deferred && <button className="btn primary" onClick={install}>{t.install}</button>}
      <button className="install-close" onClick={dismiss} aria-label={t.dismiss}>×</button>
    </div>
  );
}
