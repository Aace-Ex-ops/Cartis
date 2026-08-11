"use client";

import { useEffect, useRef } from "react";

export const DATA_CHANGED_EVENT = "cartis:data-changed";

// Re-runs `refresh` on mount and whenever data changes elsewhere
// (e.g. the AI twin saves a goal / holding / budget / profile).
export function useLiveData(refresh: () => void | Promise<void>, deps: unknown[] = []) {
  const fn = useRef(refresh);
  fn.current = refresh;

  useEffect(() => {
    void fn.current();
    const onData = () => void fn.current();
    window.addEventListener(DATA_CHANGED_EVENT, onData);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
