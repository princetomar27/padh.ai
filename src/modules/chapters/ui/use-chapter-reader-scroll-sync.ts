"use client";

import { useEffect, useRef } from "react";

const DATA_ATTR = "[data-reader-page]";

function dominantVisiblePage(
  scrollRoot: HTMLElement,
  selector: typeof DATA_ATTR,
): number | null {
  const nodes = scrollRoot.querySelectorAll<HTMLElement>(selector);
  if (nodes.length === 0) return null;

  const rootRect = scrollRoot.getBoundingClientRect();
  let bestPage: number | null = null;
  let bestVisible = 0;

  for (const el of nodes) {
    const raw = el.dataset.readerPage;
    if (raw == null || raw === "") continue;
    const page = Number(raw);
    if (!Number.isFinite(page)) continue;

    const er = el.getBoundingClientRect();
    const top = Math.max(rootRect.top, er.top);
    const bottom = Math.min(rootRect.bottom, er.bottom);
    const visible = Math.max(0, bottom - top);
    if (visible > bestVisible) {
      bestVisible = visible;
      bestPage = page;
    }
  }

  return bestPage;
}

function findScrollTargetInRight(
  rightRoot: HTMLElement,
  page: number,
): HTMLElement | null {
  return rightRoot.querySelector<HTMLElement>(
    `[data-reader-page="${page}"][data-reader-anchor="page"]`,
  );
}

function findScrollTargetInLeft(
  leftRoot: HTMLElement,
  page: number,
): HTMLElement | null {
  return leftRoot.querySelector<HTMLElement>(
    `[data-reader-page="${page}"][data-reader-anchor="segment"]`,
  );
}

function scrollWithinContainer(
  container: HTMLElement,
  element: HTMLElement,
  behavior: ScrollBehavior,
) {
  const cRect = container.getBoundingClientRect();
  const eRect = element.getBoundingClientRect();
  const nextTop = container.scrollTop + (eRect.top - cRect.top);
  container.scrollTo({ top: Math.max(0, nextTop), behavior });
}

type Options = {
  leftRef: React.RefObject<HTMLElement | null>;
  rightRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  syncKey?: string;
};

export function useChapterReaderScrollSync({
  leftRef,
  rightRef,
  enabled,
  syncKey = "",
}: Options) {
  const syncingRef = useRef(false);
  const rafClearRef = useRef<number | null>(null);

  const endSyncLock = () => {
    if (rafClearRef.current != null) {
      cancelAnimationFrame(rafClearRef.current);
    }
    rafClearRef.current = requestAnimationFrame(() => {
      rafClearRef.current = requestAnimationFrame(() => {
        syncingRef.current = false;
        rafClearRef.current = null;
      });
    });
  };

  const scrollRightToPage = (page: number) => {
    const right = rightRef.current;
    if (!right) return;
    const target = findScrollTargetInRight(right, page);
    if (!target) return;
    syncingRef.current = true;
    scrollWithinContainer(right, target, "smooth");
    endSyncLock();
  };

  const scrollLeftToPage = (page: number) => {
    const left = leftRef.current;
    if (!left) return;
    const target = findScrollTargetInLeft(left, page);
    if (!target) return;
    syncingRef.current = true;
    scrollWithinContainer(left, target, "smooth");
    endSyncLock();
  };

  useEffect(() => {
    if (!enabled) return;

    const left = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    let leftT: ReturnType<typeof setTimeout> | null = null;
    let rightT: ReturnType<typeof setTimeout> | null = null;

    const onLeftScroll = () => {
      if (syncingRef.current) return;
      if (leftT) clearTimeout(leftT);
      leftT = setTimeout(() => {
        leftT = null;
        if (syncingRef.current) return;
        const page = dominantVisiblePage(left, DATA_ATTR);
        if (page == null) return;
        scrollRightToPage(page);
      }, 72);
    };

    const onRightScroll = () => {
      if (syncingRef.current) return;
      if (rightT) clearTimeout(rightT);
      rightT = setTimeout(() => {
        rightT = null;
        if (syncingRef.current) return;
        const page = dominantVisiblePage(right, DATA_ATTR);
        if (page == null) return;
        scrollLeftToPage(page);
      }, 72);
    };

    left.addEventListener("scroll", onLeftScroll, { passive: true });
    right.addEventListener("scroll", onRightScroll, { passive: true });

    return () => {
      left.removeEventListener("scroll", onLeftScroll);
      right.removeEventListener("scroll", onRightScroll);
      if (leftT) clearTimeout(leftT);
      if (rightT) clearTimeout(rightT);
      if (rafClearRef.current != null) {
        cancelAnimationFrame(rafClearRef.current);
      }
    };
  }, [enabled, syncKey, leftRef, rightRef]);
}
