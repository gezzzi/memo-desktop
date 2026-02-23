"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import type { MemoSummary, Memo } from "@/lib/types";
import MemoList from "./components/MemoList";
import MemoEditor from "./components/MemoEditor";
import ThemeToggle from "./components/ThemeToggle";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog";
import ScratchPad from "./components/ScratchPad";
import { useAutoSaveMemo } from "./hooks/useAutoSaveMemo";
import { useUndoRedo } from "./hooks/useUndoRedo";

type FolderView =
  | { mode: "all" }
  | { mode: "folder"; path: string };

export default function Home() {
  const [memos, setMemos] = useState<MemoSummary[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "memo" | "folder";
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [folderView, setFolderView] = useState<FolderView>({ mode: "all" });
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [nestedPaths, setNestedPaths] = useState<string[]>([]);
  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [dragInsertIndex, setDragInsertIndex] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState(0);
  const folderBarRef = useRef<HTMLDivElement>(null);
  const dragOpenTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOpenTarget = useRef<string | null>(null);

  const fetchMemos = useCallback(async () => {
    const res = await fetch("/api/memos");
    const data = await res.json();
    setMemos(data.memos);
    setLoading(false);
  }, []);

  // Auto-save hook
  const autoSave = useAutoSaveMemo({ onSaved: fetchMemos });

  // Undo/Redo hook
  const undoRedo = useUndoRedo();

  // Debounced snapshot for undo history
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSnapshotRef = useRef(false);

  const scheduleSnapshot = useCallback(() => {
    if (skipSnapshotRef.current) {
      skipSnapshotRef.current = false;
      return;
    }
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      undoRedo.pushSnapshot({
        title: autoSave.title,
        body: autoSave.body,
        folder: autoSave.folder,
      });
    }, 500);
  }, [undoRedo, autoSave.title, autoSave.body, autoSave.folder]);

  useEffect(() => {
    fetchMemos();
  }, [fetchMemos]);

  useEffect(() => {
    const saved = localStorage.getItem("memo-folders");
    if (saved) {
      try {
        setCustomFolders(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("memo-folder-order");
    if (saved) {
      try {
        setFolderOrder(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const saveCustomFolders = (folders: string[]) => {
    setCustomFolders(folders);
    localStorage.setItem("memo-folders", JSON.stringify(folders));
  };

  const saveFolderOrder = (order: string[]) => {
    setFolderOrder(order);
    localStorage.setItem("memo-folder-order", JSON.stringify(order));
  };

  // All known folder paths (including intermediate)
  const allFolderPaths = useMemo(() => {
    const paths = new Set<string>();
    const addWithParents = (p: string) => {
      const segs = p.split("/");
      for (let i = 1; i <= segs.length; i++) {
        paths.add(segs.slice(0, i).join("/"));
      }
    };
    memos.forEach((m) => {
      if (m.folder) addWithParents(m.folder);
    });
    customFolders.forEach((f) => addWithParents(f));
    return Array.from(paths).sort();
  }, [memos, customFolders]);

  // Top-level folders only
  const topLevelFolders = useMemo(
    () => allFolderPaths.filter((p) => !p.includes("/")),
    [allFolderPaths]
  );

  // Ordered top-level folders (user-defined order)
  const orderedTopFolders = useMemo(() => {
    const ordered: string[] = [];
    for (const f of folderOrder) {
      if (topLevelFolders.includes(f)) ordered.push(f);
    }
    for (const f of topLevelFolders) {
      if (!ordered.includes(f)) ordered.push(f);
    }
    return ordered;
  }, [topLevelFolders, folderOrder]);

  // Children of a given path
  const getChildFolders = useCallback(
    (parentPath: string) => {
      const prefix = parentPath + "/";
      const children = new Set<string>();
      allFolderPaths.forEach((p) => {
        if (p.startsWith(prefix)) {
          const rest = p.slice(prefix.length);
          const seg = rest.split("/")[0];
          if (seg) children.add(seg);
        }
      });
      return Array.from(children).sort();
    },
    [allFolderPaths]
  );

  // Get folder contents for any path
  const getFolderMemos = useCallback(
    (path: string) => memos.filter((m) => m.folder === path),
    [memos]
  );


  // --- Handlers ---

  const handleSelect = async (id: string) => {
    await autoSave.selectMemo(id);
    // Reset undo history for the new memo — read the values after selectMemo finishes
    // We need to fetch the memo data to initialize undo
    const res = await fetch(`/api/memos/${id}`);
    if (res.ok) {
      const memo: Memo = await res.json();
      undoRedo.reset({ title: memo.title, body: memo.body, folder: memo.folder });
    }
  };

  const handleNew = async () => {
    await autoSave.createNewMemo();
    undoRedo.reset({ title: "新規ファイル", body: "", folder: "" });
  };

  const handleNewInFolder = async (folderPath: string) => {
    await autoSave.createNewMemo(folderPath);
    undoRedo.reset({ title: "新規ファイル", body: "", folder: folderPath });
  };

  const handleChange = (field: "title" | "body", value: string) => {
    if (field === "title") autoSave.setTitle(value);
    else autoSave.setBody(value);
    scheduleSnapshot();
  };

  const handleFolderChange = (value: string) => {
    autoSave.setFolder(value);
    scheduleSnapshot();
  };

  const handleUndo = useCallback(() => {
    const prev = undoRedo.undo();
    if (prev) {
      skipSnapshotRef.current = true;
      autoSave.setTitle(prev.title);
      skipSnapshotRef.current = true;
      autoSave.setBody(prev.body);
      skipSnapshotRef.current = true;
      autoSave.setFolder(prev.folder);
    }
  }, [undoRedo, autoSave]);

  const handleRedo = useCallback(() => {
    const next = undoRedo.redo();
    if (next) {
      skipSnapshotRef.current = true;
      autoSave.setTitle(next.title);
      skipSnapshotRef.current = true;
      autoSave.setBody(next.body);
      skipSnapshotRef.current = true;
      autoSave.setFolder(next.folder);
    }
  }, [undoRedo, autoSave]);

  const handleDelete = () => {
    if (autoSave.selectedId) {
      setDeleteTarget({ type: "memo", id: autoSave.selectedId, name: autoSave.title });
    }
  };

  const handleDeleteMemo = (id: string, name: string) => {
    setDeleteTarget({ type: "memo", id, name });
  };

  const handleDeleteFolder = (path: string, name: string) => {
    setDeleteTarget({ type: "folder", id: path, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "memo") {
      const res = await fetch(`/api/memos/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        if (autoSave.selectedId === deleteTarget.id) {
          autoSave.clearSelection();
        }
        await fetchMemos();
      }
    } else {
      // Delete folder: delete all memos inside, remove folder
      const folderPath = deleteTarget.id;
      const affectedMemos = memos.filter(
        (m) => m.folder === folderPath || m.folder.startsWith(folderPath + "/")
      );
      for (const m of affectedMemos) {
        await fetch(`/api/memos/${m.id}`, { method: "DELETE" });
        if (autoSave.selectedId === m.id) {
          autoSave.clearSelection();
        }
      }
      const updated = customFolders.filter(
        (f) => f !== folderPath && !f.startsWith(folderPath + "/")
      );
      saveCustomFolders(updated);
      await fetchMemos();
    }
    setDeleteTarget(null);
  };

  // Move a single memo to a folder
  const moveMemoToFolder = async (memoId: string, targetFolder: string) => {
    const getRes = await fetch(`/api/memos/${memoId}`);
    if (!getRes.ok) return;
    const memo: Memo = await getRes.json();
    const res = await fetch(`/api/memos/${memoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: memo.title,
        body: memo.body,
        folder: targetFolder,
      }),
    });
    if (res.ok) {
      if (autoSave.selectedId === memoId) {
        autoSave.updateFolderSilently(targetFolder);
      }
    }
  };

  // Move folder src into folder target (src becomes target/srcName)
  const moveFolderIntoFolder = async (src: string, target: string) => {
    const srcName = src.split("/").pop()!;
    const newBase = target ? `${target}/${srcName}` : srcName;

    // Prevent circular move
    if (target === src || target.startsWith(src + "/")) return;
    // Already there
    if (src === newBase) return;

    // Update memos
    const affectedMemos = memos.filter(
      (m) => m.folder === src || m.folder.startsWith(src + "/")
    );
    for (const m of affectedMemos) {
      const newFolder = newBase + m.folder.slice(src.length);
      await moveMemoToFolder(m.id, newFolder);
    }

    // Update custom folders
    const updated = customFolders.map((f) => {
      if (f === src || f.startsWith(src + "/")) {
        return newBase + f.slice(src.length);
      }
      return f;
    });
    saveCustomFolders(updated);
    await fetchMemos();
  };

  // Drop handler for folder bar buttons
  const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    clearDragOpenTimeout();
    setOpenDropdown(null);
    setNestedPaths([]);

    const memoId = e.dataTransfer.getData("memo-id");
    const folderPath = e.dataTransfer.getData("folder-path");

    if (memoId) {
      await moveMemoToFolder(memoId, targetFolder);
      await fetchMemos();
    } else if (folderPath) {
      await moveFolderIntoFolder(folderPath, targetFolder);
    }
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(key);
  };

  // Reorder folder drop
  const handleReorderDrop = (e: React.DragEvent, insertIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragInsertIndex(null);
    setDragOverTarget(null);

    const folderPath = e.dataTransfer.getData("folder-path");
    if (!folderPath || !orderedTopFolders.includes(folderPath)) return;

    const currentIndex = orderedTopFolders.indexOf(folderPath);
    if (currentIndex === insertIndex || currentIndex + 1 === insertIndex) return;

    const newOrder = [...orderedTopFolders];
    newOrder.splice(currentIndex, 1);
    const adjustedIndex = insertIndex > currentIndex ? insertIndex - 1 : insertIndex;
    newOrder.splice(adjustedIndex, 0, folderPath);
    saveFolderOrder(newOrder);
  };

  // Capture dropdown position from button
  const captureDropdownPos = (e: React.MouseEvent) => {
    const bar = folderBarRef.current;
    if (bar) {
      const barRect = bar.getBoundingClientRect();
      const btnRect = e.currentTarget.getBoundingClientRect();
      setDropdownPos(btnRect.left - barRect.left);
    }
  };

  // Hover to open dropdown
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFolderHover = (e: React.MouseEvent, key: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    captureDropdownPos(e);
    setOpenDropdown(key);
    setNestedPaths([]);
  };

  const handleFolderBarMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 200);
  };

  const handleDropdownMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  };

  const handleDropdownMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setOpenDropdown(null);
      setNestedPaths([]);
    }, 200);
  };

  // Folder bar click — select folder filter
  const handleFolderBarClick = (folderPath: string) => {
    setFolderView({ mode: "folder", path: folderPath });
  };

  // Hover sub-folder in dropdown at given nesting level
  const handleSubFolderHover = (level: number, fullPath: string) => {
    setNestedPaths((prev) => [...prev.slice(0, level), fullPath]);
  };

  // Dropdown memo click
  const handleDropdownMemoClick = (id: string) => {
    handleSelect(id);
    setOpenDropdown(null);
  };

  // Drag-hover: auto-open folder dropdown / submenu while dragging
  const clearDragOpenTimeout = () => {
    if (dragOpenTimeout.current) {
      clearTimeout(dragOpenTimeout.current);
      dragOpenTimeout.current = null;
    }
    dragOpenTarget.current = null;
  };

  const handleDragOverFolder = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    if (dragOpenTarget.current !== key) {
      clearDragOpenTimeout();
      dragOpenTarget.current = key;
      const bar = folderBarRef.current;
      if (bar) {
        const barRect = bar.getBoundingClientRect();
        const btnRect = e.currentTarget.getBoundingClientRect();
        const pos = btnRect.left - barRect.left;
        dragOpenTimeout.current = setTimeout(() => {
          setDropdownPos(pos);
          setOpenDropdown(key);
          setNestedPaths([]);
        }, 400);
      }
    }
  };

  const handleDragOverSubFolder = (e: React.DragEvent, level: number, fullPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOpenTarget.current !== fullPath) {
      clearDragOpenTimeout();
      dragOpenTarget.current = fullPath;
      dragOpenTimeout.current = setTimeout(() => {
        handleSubFolderHover(level, fullPath);
      }, 400);
    }
  };

  // Rename folder
  const handleRenameFolder = async (oldPath: string, newName: string) => {
    const segments = oldPath.split("/");
    segments[segments.length - 1] = newName;
    const newPath = segments.join("/");

    // Prevent rename to existing folder
    if (allFolderPaths.includes(newPath)) return;

    // Update memos whose folder matches or is nested under oldPath
    const affectedMemos = memos.filter(
      (m) => m.folder === oldPath || m.folder.startsWith(oldPath + "/")
    );
    for (const m of affectedMemos) {
      const newFolder = newPath + m.folder.slice(oldPath.length);
      await moveMemoToFolder(m.id, newFolder);
    }

    // Update customFolders
    const updatedCustom = customFolders.map((f) => {
      if (f === oldPath || f.startsWith(oldPath + "/")) {
        return newPath + f.slice(oldPath.length);
      }
      return f;
    });
    saveCustomFolders(updatedCustom);

    // Update folderOrder (top-level only)
    const updatedOrder = folderOrder.map((f) => (f === oldPath ? newPath : f));
    saveFolderOrder(updatedOrder);

    // Update current selection's folder if affected
    if (autoSave.selectedId) {
      if (autoSave.folder === oldPath || autoSave.folder.startsWith(oldPath + "/")) {
        const newFolder = newPath + autoSave.folder.slice(oldPath.length);
        autoSave.updateFolderSilently(newFolder);
      }
    }

    await fetchMemos();
  };

  // Create folder
  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) {
      setNewFolderName("");
      setCreatingFolder(false);
      return;
    }
    if (!customFolders.includes(name) && !allFolderPaths.includes(name)) {
      saveCustomFolders([...customFolders, name]);
    }
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const FolderIcon = ({ size = 12 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      className="text-foreground/90"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );

  const FileIcon = ({ size = 12 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-foreground"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-5 h-12 border-b border-border bg-sidebar backdrop-blur-xl">
        <div className="w-20" />
        <h1 className="text-sm font-medium text-muted tracking-wide">Memo</h1>
        <div className="w-20 flex items-center justify-end">
          <ThemeToggle />
        </div>
      </header>

      {/* Folder bar */}
      <div ref={folderBarRef} className="relative z-50 border-b border-border bg-sidebar backdrop-blur-xl">
        {/* Scrollable button area */}
        <div className="flex items-center gap-1 px-5 h-9 overflow-x-auto">
          {/* Top-level folders with reorder drop zones */}
          {orderedTopFolders.map((f, i) => (
            <Fragment key={f}>
              {/* Reorder drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragInsertIndex(i);
                  setDragOverTarget(null);
                }}
                onDragLeave={() => setDragInsertIndex(null)}
                onDrop={(e) => handleReorderDrop(e, i)}
                className="shrink-0 w-2 self-stretch flex items-center justify-center"
              >
                {dragInsertIndex === i && (
                  <div className="w-0.5 h-4 rounded-full bg-accent" />
                )}
              </div>
              <button
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("folder-path", f);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragInsertIndex(null);
                  setDragOverTarget(null);
                  clearDragOpenTimeout();
                }}
                onClick={() => handleFolderBarClick(f)}
                onMouseEnter={(e) => handleFolderHover(e, f)}
                onMouseLeave={handleFolderBarMouseLeave}
                onDragOver={(e) => handleDragOverFolder(e, f)}
                className={`px-2.5 py-1 text-xs rounded-lg shrink-0 transition-colors flex items-center gap-1 text-foreground ${
                  openDropdown === f
                    ? "bg-foreground/10"
                    : "hover:bg-foreground/5"
                }`}
              >
                <FolderIcon />
                {f}
              </button>
            </Fragment>
          ))}
          {/* Last reorder drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragInsertIndex(orderedTopFolders.length);
              setDragOverTarget(null);
            }}
            onDragLeave={() => setDragInsertIndex(null)}
            onDrop={(e) => handleReorderDrop(e, orderedTopFolders.length)}
            className="shrink-0 w-2 self-stretch flex items-center justify-center"
          >
            {dragInsertIndex === orderedTopFolders.length && (
              <div className="w-0.5 h-4 rounded-full bg-accent" />
            )}
          </div>

          {/* Uncategorized memos as file items */}
          {memos
            .filter((m) => !m.folder)
            .map((memo) => (
              <button
                key={memo.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("memo-id", memo.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => handleSelect(memo.id)}
                className="px-2.5 py-1 text-xs rounded-lg shrink-0 transition-colors flex items-center gap-1 text-foreground hover:bg-foreground/5"
              >
                <FileIcon />
                <span className="truncate max-w-[120px]">{memo.title}</span>
              </button>
            ))}

          {/* Create folder */}
          {creatingFolder ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateFolder();
              }}
              className="flex items-center shrink-0"
            >
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={handleCreateFolder}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setNewFolderName("");
                    setCreatingFolder(false);
                  }
                }}
                placeholder="フォルダ名"
                autoFocus
                className="w-24 px-2 py-0.5 text-xs rounded-lg bg-surface ring-1 ring-border-strong outline-none placeholder:text-muted/50"
              />
            </form>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="p-1 rounded-lg shrink-0 text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
              aria-label="フォルダを作成"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}

          {/* New memo button */}
          <button
            onClick={handleNew}
            className="p-1 rounded-lg shrink-0 text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
            aria-label="新規メモ"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
            </svg>
          </button>
        </div>

        {/* Cascading dropdown for folders - rendered outside scrollable area */}
        {openDropdown && (() => {
          const panels = [openDropdown, ...nestedPaths];
          return (
            <div
              onMouseEnter={handleDropdownMouseEnter}
              onMouseLeave={handleDropdownMouseLeave}
            >
              {panels.map((panelPath, level) => {
                const subFolders = getChildFolders(panelPath);
                const panelMemos = getFolderMemos(panelPath);
                const panelKey = `panel-${panelPath}`;
                return (
                  <div
                    key={panelPath}
                    className={`absolute top-full mt-1 bg-surface rounded-xl shadow-lg ring-1 z-50 py-1 min-w-[220px] max-h-[320px] overflow-y-auto ${
                      dragOverTarget === panelKey
                        ? "ring-2 ring-accent bg-accent/5"
                        : "ring-border-strong"
                    }`}
                    style={{ left: dropdownPos + 224 * level }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDragOverTarget(panelKey);
                      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDragOverTarget(null);
                      }
                    }}
                    onDrop={(e) => handleDrop(e, panelPath)}
                  >
                    {/* Sub-folders */}
                    {subFolders.map((name) => {
                      const fullPath = `${panelPath}/${name}`;
                      const isHovered = nestedPaths[level] === fullPath;
                      return (
                        <button
                          key={name}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("folder-path", fullPath);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onClick={() => {
                            setFolderView({ mode: "folder", path: fullPath });
                            setOpenDropdown(null);
                          }}
                          onMouseEnter={() => handleSubFolderHover(level, fullPath)}
                          onDragOver={(e) => handleDragOverSubFolder(e, level, fullPath)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-foreground/5 flex items-center justify-between transition-colors ${
                            isHovered ? "bg-foreground/5" : ""
                          }`}
                        >
                          <span className="flex items-center gap-1.5 text-foreground">
                            <FolderIcon />
                            {name}
                          </span>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-foreground/50"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      );
                    })}

                    {/* Separator if both folders and memos */}
                    {subFolders.length > 0 && panelMemos.length > 0 && (
                      <div className="h-px bg-border mx-2 my-1" />
                    )}

                    {/* Memos in this folder */}
                    {panelMemos.map((memo) => (
                      <button
                        key={memo.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("memo-id", memo.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => handleDropdownMemoClick(memo.id)}
                        onMouseEnter={() => setNestedPaths((prev) => prev.slice(0, level))}
                        className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-foreground/5 flex items-center gap-1.5 transition-colors"
                      >
                        <FileIcon />
                        <span className="truncate">{memo.title}</span>
                      </button>
                    ))}

                    {/* Empty state */}
                    {subFolders.length === 0 && panelMemos.length === 0 && (
                      <div className="px-3 py-3 text-xs text-muted/50">
                        ここにドロップして移動
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-border bg-sidebar backdrop-blur-xl flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-xs text-muted">
                読み込み中...
              </div>
            ) : (
              <MemoList
                memos={memos}
                allFolderPaths={allFolderPaths}
                topLevelFolders={orderedTopFolders}
                selectedId={autoSave.selectedId}
                onSelect={handleSelect}
                onMoveToFolder={async (memoId, targetFolder) => {
                  await moveMemoToFolder(memoId, targetFolder);
                  await fetchMemos();
                }}
                onMoveFolderIntoFolder={moveFolderIntoFolder}
                onDeleteMemo={handleDeleteMemo}
                onDeleteFolder={handleDeleteFolder}
                onNewMemo={handleNewInFolder}
                onRenameFolder={handleRenameFolder}
                onNewFolder={(parentPath) => {
                  const name = window.prompt("フォルダ名を入力");
                  if (!name?.trim()) return;
                  const fullPath = parentPath
                    ? `${parentPath}/${name.trim()}`
                    : name.trim();
                  if (
                    !customFolders.includes(fullPath) &&
                    !allFolderPaths.includes(fullPath)
                  ) {
                    saveCustomFolders([...customFolders, fullPath]);
                  }
                }}
              />
            )}
          </div>
        </aside>

        {/* Editor */}
        <main className="flex-1 flex flex-col bg-background">
          <MemoEditor
            title={autoSave.title}
            body={autoSave.body}
            folder={autoSave.folder}
            isNew={autoSave.isNew}
            hasSelection={autoSave.selectedId !== null}
            allFolders={allFolderPaths}
            saveStatus={autoSave.saveStatus}
            canUndo={undoRedo.canUndo}
            canRedo={undoRedo.canRedo}
            onChange={handleChange}
            onFolderChange={handleFolderChange}
            onDelete={handleDelete}
            onNew={handleNew}
            onUndo={handleUndo}
            onRedo={handleRedo}
          />
        </main>

        {/* Divider */}
        <div className="w-px bg-border" />

        {/* Scratch Pad */}
        <aside className="flex-1 flex flex-col bg-background">
          <ScratchPad />
        </aside>
      </div>

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        title={
          deleteTarget?.type === "memo"
            ? "メモを削除しますか？"
            : "フォルダを削除しますか？"
        }
        message={
          deleteTarget?.type === "memo"
            ? `「${deleteTarget?.name}」を削除します。この操作は元に戻せません。`
            : `「${deleteTarget?.name}」フォルダとフォルダ内のすべてのファイルを削除します。この操作は元に戻せません。`
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
