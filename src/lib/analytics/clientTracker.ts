"use client";

import type { ProductEventInput, ProductEventName } from "./types";

const MAX_BATCH = 20;
const FLUSH_DELAY_MS = 1200;

let eventQueue: ProductEventInput[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

function generateEventUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function bindPageLifecycleListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  const flushOnHide = () => {
    if (document.visibilityState === "hidden") {
      flushProductEvents(true);
    }
  };
  window.addEventListener("pagehide", () => flushProductEvents(true));
  document.addEventListener("visibilitychange", flushOnHide);
}

export function flushProductEvents(useBeacon = false): void {
  if (typeof window === "undefined" || eventQueue.length === 0) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = eventQueue.slice(0, MAX_BATCH);
  eventQueue = eventQueue.slice(MAX_BATCH);

  const payload = JSON.stringify({ events: batch });
  try {
    if (
      useBeacon &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/events", blob);
    } else {
      void fetch("/api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Best-effort tracking never blocks UI
  }

  if (eventQueue.length > 0) {
    flushTimer = setTimeout(() => flushProductEvents(false), FLUSH_DELAY_MS);
  }
}

export function trackProductEvent(input: {
  eventName: ProductEventName;
  routeKey?: string | null;
  contentType?: "club_post" | "player_profile" | "sponsor" | "match" | null;
  contentId?: number | null;
  sponsorId?: number | null;
  metadata?: Record<string, string | number | boolean> | null;
}): void {
  if (typeof window === "undefined") return;
  bindPageLifecycleListeners();

  eventQueue.push({
    eventUuid: generateEventUuid(),
    eventName: input.eventName,
    routeKey: input.routeKey ?? null,
    contentType: input.contentType ?? null,
    contentId: input.contentId ?? null,
    sponsorId: input.sponsorId ?? null,
    metadata: input.metadata ?? null,
  });

  if (eventQueue.length >= MAX_BATCH) {
    flushProductEvents(false);
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => flushProductEvents(false), FLUSH_DELAY_MS);
  }
}

const impressedOnPage = new Set<string>();

export function resetImpressionDedupeForTest(): void {
  impressedOnPage.clear();
}

/**
 * Observes a sponsor element and records `sponsor_impression` only when >= 50%
 * visible continuously for at least 1000ms, deduped per page view.
 */
export function observeSponsorImpression(
  element: HTMLElement | null,
  sponsorId: number,
  placement: string
): () => void {
  if (!element || typeof IntersectionObserver === "undefined" || sponsorId <= 0) {
    return () => undefined;
  }

  const dedupeKey = `${sponsorId}:${placement}`;
  if (impressedOnPage.has(dedupeKey)) {
    return () => undefined;
  }

  let dwellTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        if (!dwellTimer && !impressedOnPage.has(dedupeKey)) {
          dwellTimer = setTimeout(() => {
            if (!impressedOnPage.has(dedupeKey)) {
              impressedOnPage.add(dedupeKey);
              trackProductEvent({
                eventName: "sponsor_impression",
                routeKey: "/",
                contentType: "sponsor",
                sponsorId,
                metadata: { placement },
              });
            }
          }, 1000);
        }
      } else if (dwellTimer) {
        clearTimeout(dwellTimer);
        dwellTimer = null;
      }
    },
    { threshold: [0.5] }
  );

  observer.observe(element);
  return () => {
    if (dwellTimer) clearTimeout(dwellTimer);
    observer.disconnect();
  };
}
