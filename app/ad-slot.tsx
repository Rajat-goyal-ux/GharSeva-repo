"use client";

import { useEffect } from "react";
import { ADSENSE_CLIENT, ADSENSE_SLOTS } from "./adsense-config";

type Placement = "services" | "vendors";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export default function AdSlot({ placement }: { placement: Placement }) {
  const slot = ADSENSE_SLOTS[placement];

  useEffect(() => {
    if (!slot) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers and a pending AdSense review can prevent initialization.
    }
  }, [slot]);

  if (!slot) return null;

  return (
    <aside className="ad-placement shell" aria-label="Advertisement">
      <span>Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
