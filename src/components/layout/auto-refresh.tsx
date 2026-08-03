"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the server components on a timer, so a wall display left open all
 * day keeps showing current numbers without anyone pressing F5.
 *
 * `router.refresh()` rather than `location.reload()`: it re-runs the server
 * render and swaps in the new markup while every client component keeps its
 * state. A half-typed rename, an open dropdown and the scroll position all
 * survive — a full reload would throw them away several times a minute.
 *
 * This costs the DATABASE a query, not Tuya an API call. The poller is the only
 * thing that talks to Tuya, so refreshing often is free of quota consequences.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();

  useEffect(() => {
    // A hidden tab is nobody's dashboard. Refreshing it burns server work for a
    // screen no one can see, so the timer only runs while the tab is visible —
    // and fires once immediately on return, when the data is at its stalest.
    let timer: ReturnType<typeof setInterval> | undefined;

    function start() {
      stop();
      timer = setInterval(() => router.refresh(), seconds * 1000);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        router.refresh();
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, seconds]);

  return null;
}
