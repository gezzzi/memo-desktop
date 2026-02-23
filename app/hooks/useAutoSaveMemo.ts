"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Memo } from "@/lib/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveMemoOptions {
  onSaved: () => Promise<void> | void;
}

export function useAutoSaveMemo({ onSaved }: UseAutoSaveMemoOptions) {
  const [title, setTitleState] = useState("");
  const [body, setBodyState] = useState("");
  const [folder, setFolderState] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Refs for debounce and save coordination
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef<Promise<void> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingRef = useRef(false);

  // Refs to hold latest values (avoid stale closures in debounced callbacks)
  const titleRef = useRef(title);
  const bodyRef = useRef(body);
  const folderRef = useRef(folder);
  const selectedIdRef = useRef(selectedId);
  const isNewRef = useRef(isNew);

  titleRef.current = title;
  bodyRef.current = body;
  folderRef.current = folder;
  selectedIdRef.current = selectedId;
  isNewRef.current = isNew;

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  const showSaved = useCallback(() => {
    setSaveStatus("saved");
    clearSavedTimer();
    savedTimerRef.current = setTimeout(() => {
      setSaveStatus("idle");
    }, 2000);
  }, [clearSavedTimer]);

  const performSave = useCallback(async () => {
    if (deletingRef.current) return;

    const currentTitle = titleRef.current.trim() || "新規ファイル";
    const currentBody = bodyRef.current;
    const currentFolder = folderRef.current;
    const currentId = selectedIdRef.current;
    const currentIsNew = isNewRef.current;

    setSaveStatus("saving");

    try {
      if (currentIsNew && !currentId) {
        // Create new memo via POST
        const res = await fetch("/api/memos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: currentTitle,
            body: currentBody,
            folder: currentFolder,
          }),
        });
        if (res.ok) {
          const memo: Memo = await res.json();
          setSelectedId(memo.id);
          selectedIdRef.current = memo.id;
          setIsNew(false);
          isNewRef.current = false;
          dirtyRef.current = false;
          showSaved();
          await onSaved();
        } else {
          setSaveStatus("error");
        }
      } else if (currentId) {
        // Update existing memo via PUT
        const res = await fetch(`/api/memos/${currentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: currentTitle,
            body: currentBody,
            folder: currentFolder,
          }),
        });
        if (res.ok) {
          dirtyRef.current = false;
          showSaved();
          await onSaved();
        } else {
          setSaveStatus("error");
        }
      }
    } catch {
      setSaveStatus("error");
    }
  }, [onSaved, showSaved]);

  // Serialize saves: wait for any in-flight save to finish first
  const serializedSave = useCallback(async () => {
    if (savingRef.current) {
      await savingRef.current;
    }
    const promise = performSave();
    savingRef.current = promise;
    await promise;
    savingRef.current = null;
  }, [performSave]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (dirtyRef.current) {
        serializedSave();
      }
    }, 800);
  }, [serializedSave]);

  const flushSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (dirtyRef.current && !deletingRef.current) {
      await serializedSave();
    }
  }, [serializedSave]);

  const markDirtyAndSchedule = useCallback(() => {
    dirtyRef.current = true;
    clearSavedTimer();
    setSaveStatus("idle");
    scheduleSave();
  }, [scheduleSave, clearSavedTimer]);

  // Public setters
  const setTitle = useCallback(
    (v: string) => {
      setTitleState(v);
      titleRef.current = v;
      markDirtyAndSchedule();
    },
    [markDirtyAndSchedule]
  );

  const setBody = useCallback(
    (v: string) => {
      setBodyState(v);
      bodyRef.current = v;
      markDirtyAndSchedule();
    },
    [markDirtyAndSchedule]
  );

  const setFolder = useCallback(
    (v: string) => {
      setFolderState(v);
      folderRef.current = v;
      markDirtyAndSchedule();
    },
    [markDirtyAndSchedule]
  );

  // Select an existing memo (flush current first)
  const selectMemo = useCallback(
    async (id: string) => {
      await flushSave();
      const res = await fetch(`/api/memos/${id}`);
      if (!res.ok) return;
      const memo: Memo = await res.json();
      setTitleState(memo.title);
      setBodyState(memo.body);
      setFolderState(memo.folder);
      titleRef.current = memo.title;
      bodyRef.current = memo.body;
      folderRef.current = memo.folder;
      setSelectedId(memo.id);
      selectedIdRef.current = memo.id;
      setIsNew(false);
      isNewRef.current = false;
      dirtyRef.current = false;
      clearSavedTimer();
      setSaveStatus("idle");
    },
    [flushSave, clearSavedTimer]
  );

  // Create a new memo
  const createNewMemo = useCallback(
    async (folderPath = "") => {
      await flushSave();
      const defaultTitle = "新規ファイル";
      setTitleState(defaultTitle);
      setBodyState("");
      setFolderState(folderPath);
      titleRef.current = defaultTitle;
      bodyRef.current = "";
      folderRef.current = folderPath;
      setSelectedId(null);
      selectedIdRef.current = null;
      setIsNew(true);
      isNewRef.current = true;
      dirtyRef.current = false;
      clearSavedTimer();
      setSaveStatus("idle");
    },
    [flushSave, clearSavedTimer]
  );

  // Clear selection (e.g., after delete)
  const clearSelection = useCallback(() => {
    deletingRef.current = true;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    dirtyRef.current = false;
    setTitleState("");
    setBodyState("");
    setFolderState("");
    titleRef.current = "";
    bodyRef.current = "";
    folderRef.current = "";
    setSelectedId(null);
    selectedIdRef.current = null;
    setIsNew(false);
    isNewRef.current = false;
    clearSavedTimer();
    setSaveStatus("idle");
    // Reset deleting flag after clearing
    setTimeout(() => {
      deletingRef.current = false;
    }, 0);
  }, [clearSavedTimer]);

  // Update folder without triggering dirty (used after rename from sidebar)
  const updateFolderSilently = useCallback((newFolder: string) => {
    setFolderState(newFolder);
    folderRef.current = newFolder;
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  return {
    title,
    body,
    folder,
    selectedId,
    isNew,
    saveStatus,
    setTitle,
    setBody,
    setFolder,
    selectMemo,
    createNewMemo,
    clearSelection,
    updateFolderSilently,
    flushSave,
  };
}
