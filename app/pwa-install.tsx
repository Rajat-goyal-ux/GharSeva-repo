"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaInstall() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (isStandalone) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) queueMicrotask(() => setShowIosHelp(true));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      setShowIosHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || (!promptEvent && !showIosHelp)) return null;

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  }

  return (
    <aside className="install-app-card" aria-label="Install GharSeva app">
      <Image src="/app-icon-192.png" alt="" width={48} height={48} />
      <div>
        <strong>GharSeva mobile में install करें</strong>
        <span>{showIosHelp && !promptEvent ? "Share → Add to Home Screen चुनें" : "Fast access, full-screen app experience"}</span>
      </div>
      {promptEvent && <button className="install-now" onClick={install}>Install</button>}
      <button className="install-close" onClick={() => setDismissed(true)} aria-label="Install message बंद करें">×</button>
    </aside>
  );
}
