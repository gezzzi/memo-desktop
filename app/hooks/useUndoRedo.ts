"use client";

import { useRef, useState, useCallback } from "react";

interface HistoryEntry {
  title: string;
  body: string;
  folder: string;
}

const MAX_HISTORY = 100;

function isEqual(a: HistoryEntry, b: HistoryEntry): boolean {
  return a.title === b.title && a.body === b.body && a.folder === b.folder;
}

export function useUndoRedo() {
  const historyRef = useRef<HistoryEntry[]>([]);
  const pointerRef = useRef(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = useCallback(() => {
    setCanUndo(pointerRef.current > 0);
    setCanRedo(pointerRef.current < historyRef.current.length - 1);
  }, []);

  const reset = useCallback(
    (state: HistoryEntry) => {
      historyRef.current = [{ ...state }];
      pointerRef.current = 0;
      updateFlags();
    },
    [updateFlags]
  );

  const pushSnapshot = useCallback(
    (state: HistoryEntry) => {
      const history = historyRef.current;
      const pointer = pointerRef.current;

      // Skip if identical to current entry
      if (pointer >= 0 && pointer < history.length && isEqual(history[pointer], state)) {
        return;
      }

      // Truncate forward history
      historyRef.current = history.slice(0, pointer + 1);

      // Push new entry
      historyRef.current.push({ ...state });

      // Cap at max
      if (historyRef.current.length > MAX_HISTORY) {
        historyRef.current = historyRef.current.slice(-MAX_HISTORY);
      }

      pointerRef.current = historyRef.current.length - 1;
      updateFlags();
    },
    [updateFlags]
  );

  const undo = useCallback((): HistoryEntry | null => {
    if (pointerRef.current <= 0) return null;
    pointerRef.current -= 1;
    updateFlags();
    return { ...historyRef.current[pointerRef.current] };
  }, [updateFlags]);

  const redo = useCallback((): HistoryEntry | null => {
    if (pointerRef.current >= historyRef.current.length - 1) return null;
    pointerRef.current += 1;
    updateFlags();
    return { ...historyRef.current[pointerRef.current] };
  }, [updateFlags]);

  return {
    canUndo,
    canRedo,
    pushSnapshot,
    undo,
    redo,
    reset,
  };
}
