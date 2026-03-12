"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { MemoSummary, Memo, FocusedSidebarItem, SidebarOrder } from "@/lib/types";
import MemoList from "./components/MemoList";
import MemoEditor from "./components/MemoEditor";
import ThemeToggle from "./components/ThemeToggle";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog";
import ScratchPad from "./components/ScratchPad";
import { useAutoSaveMemo } from "./hooks/useAutoSaveMemo";
import { useUndoRedo } from "./hooks/useUndoRedo";

export default function Home() {
  const [memos, setMemos] = useState<MemoSummary[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "memo" | "folder";
    id: string;
    name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [sidebarOrder, setSidebarOrder] = useState<SidebarOrder>({});
  const [focusedSidebarItem, setFocusedSidebarItem] = useState<FocusedSidebarItem>(null);

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
    try {
      const folders = localStorage.getItem("memo-folders");
      if (folders) setCustomFolders(JSON.parse(folders));
      const savedOrder = localStorage.getItem("memo-sidebar-order");
      if (savedOrder) {
        setSidebarOrder(JSON.parse(savedOrder));
      } else {
        // Migrate from old format
        const oldOrder = localStorage.getItem("memo-folder-order");
        if (oldOrder) {
          const oldFolders: string[] = JSON.parse(oldOrder);
          const migrated: SidebarOrder = { "": { folders: oldFolders } };
          setSidebarOrder(migrated);
          localStorage.setItem("memo-sidebar-order", JSON.stringify(migrated));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const saveCustomFolders = (folders: string[]) => {
    setCustomFolders(folders);
    localStorage.setItem("memo-folders", JSON.stringify(folders));
  };

  const saveSidebarOrder = (order: SidebarOrder) => {
    setSidebarOrder(order);
    localStorage.setItem("memo-sidebar-order", JSON.stringify(order));
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

  // Build ordered children (folders + memos) for a given scope
  const buildOrderedChildren = useCallback(
    (scope: string): { folders: string[]; memos: MemoSummary[] } => {
      // Get actual child folder names at this scope
      let actualFolderNames: string[];
      if (scope === "") {
        actualFolderNames = topLevelFolders;
      } else {
        const prefix = scope + "/";
        const children = new Set<string>();
        allFolderPaths.forEach((p) => {
          if (p.startsWith(prefix)) {
            const seg = p.slice(prefix.length).split("/")[0];
            if (seg) children.add(seg);
          }
        });
        actualFolderNames = Array.from(children);
      }

      // Get actual memos at this scope
      const actualMemos = scope === ""
        ? memos.filter((m) => !m.folder)
        : memos.filter((m) => m.folder === scope);

      const saved = sidebarOrder[scope];
      if (!saved) {
        return {
          folders: [...actualFolderNames].sort(),
          memos: actualMemos,
        };
      }

      // Apply saved folder order
      const savedFolders = saved.folders || [];
      const actualFolderSet = new Set(actualFolderNames);
      const orderedFolders: string[] = [];
      for (const f of savedFolders) {
        if (actualFolderSet.has(f)) orderedFolders.push(f);
      }
      for (const f of [...actualFolderNames].sort()) {
        if (!orderedFolders.includes(f)) orderedFolders.push(f);
      }

      // Apply saved memo order
      const savedMemos = saved.memos || [];
      const actualMemoMap = new Map(actualMemos.map((m) => [m.id, m]));
      const orderedMemos: MemoSummary[] = [];
      for (const id of savedMemos) {
        const m = actualMemoMap.get(id);
        if (m) orderedMemos.push(m);
      }
      for (const m of actualMemos) {
        if (!orderedMemos.some((o) => o.id === m.id)) orderedMemos.push(m);
      }

      return { folders: orderedFolders, memos: orderedMemos };
    },
    [sidebarOrder, topLevelFolders, allFolderPaths, memos]
  );



  // --- Handlers ---

  const handleSelect = async (id: string) => {
    const memo = await autoSave.selectMemo(id);
    if (memo) {
      undoRedo.reset({ title: memo.title, body: memo.body, folder: memo.folder });
    }
  };

  // Sidebar reorder (Alt+↑/↓)
  const handleSidebarReorder = useCallback(
    (direction: "up" | "down") => {
      if (!focusedSidebarItem) return;

      let scope: string;
      let isFolder: boolean;
      let itemKey: string;

      if (focusedSidebarItem.type === "folder") {
        const path = focusedSidebarItem.path;
        const lastSlash = path.lastIndexOf("/");
        scope = lastSlash === -1 ? "" : path.slice(0, lastSlash);
        itemKey = lastSlash === -1 ? path : path.slice(lastSlash + 1);
        isFolder = true;
      } else {
        const memo = memos.find((m) => m.id === focusedSidebarItem.id);
        if (!memo) return;
        scope = memo.folder || "";
        itemKey = memo.id;
        isFolder = false;
      }

      const { folders, memos: scopeMemos } = buildOrderedChildren(scope);
      const arr = isFolder ? [...folders] : scopeMemos.map((m) => m.id);
      const idx = arr.indexOf(itemKey);
      if (idx === -1) return;
      if (direction === "up" && idx <= 0) return;
      if (direction === "down" && idx >= arr.length - 1) return;

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];

      const updated = { ...sidebarOrder };
      if (!updated[scope]) updated[scope] = {};
      if (isFolder) {
        updated[scope] = { ...updated[scope], folders: arr };
      } else {
        updated[scope] = { ...updated[scope], memos: arr };
      }
      saveSidebarOrder(updated);
    },
    [focusedSidebarItem, memos, sidebarOrder, buildOrderedChildren]
  );

  // Keyboard handler for Alt+↑/↓
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const active = document.activeElement;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return;
      if (!focusedSidebarItem) return;
      e.preventDefault();
      handleSidebarReorder(e.key === "ArrowUp" ? "up" : "down");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedSidebarItem, handleSidebarReorder]);

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
      if (affectedMemos.some((m) => m.id === autoSave.selectedId)) {
        autoSave.clearSelection();
      }
      await Promise.all(
        affectedMemos.map((m) => fetch(`/api/memos/${m.id}`, { method: "DELETE" }))
      );
      const updated = customFolders.filter(
        (f) => f !== folderPath && !f.startsWith(folderPath + "/")
      );
      saveCustomFolders(updated);
      await fetchMemos();
    }
    // Clear focused sidebar item if deleted
    if (focusedSidebarItem) {
      if (
        (focusedSidebarItem.type === "memo" && deleteTarget.id === focusedSidebarItem.id) ||
        (focusedSidebarItem.type === "folder" && deleteTarget.id === focusedSidebarItem.path)
      ) {
        setFocusedSidebarItem(null);
      }
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
    await Promise.all(
      affectedMemos.map((m) => {
        const newFolder = newBase + m.folder.slice(src.length);
        return moveMemoToFolder(m.id, newFolder);
      })
    );

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
    await Promise.all(
      affectedMemos.map((m) => {
        const newFolder = newPath + m.folder.slice(oldPath.length);
        return moveMemoToFolder(m.id, newFolder);
      })
    );

    // Update customFolders
    const updatedCustom = customFolders.map((f) => {
      if (f === oldPath || f.startsWith(oldPath + "/")) {
        return newPath + f.slice(oldPath.length);
      }
      return f;
    });
    saveCustomFolders(updatedCustom);

    // Update sidebarOrder
    const updatedSidebarOrder = { ...sidebarOrder };
    const parentScope = oldPath.includes("/") ? oldPath.slice(0, oldPath.lastIndexOf("/")) : "";
    const oldName = oldPath.split("/").pop()!;
    if (updatedSidebarOrder[parentScope]?.folders) {
      updatedSidebarOrder[parentScope] = {
        ...updatedSidebarOrder[parentScope],
        folders: updatedSidebarOrder[parentScope].folders!.map(
          (f) => (f === oldName ? newName : f)
        ),
      };
    }
    // Rename scope keys
    for (const key of Object.keys(updatedSidebarOrder)) {
      if (key === oldPath) {
        updatedSidebarOrder[newPath] = updatedSidebarOrder[key];
        delete updatedSidebarOrder[oldPath];
      } else if (key.startsWith(oldPath + "/")) {
        const newKey = newPath + key.slice(oldPath.length);
        updatedSidebarOrder[newKey] = updatedSidebarOrder[key];
        delete updatedSidebarOrder[key];
      }
    }
    saveSidebarOrder(updatedSidebarOrder);

    // Update current selection's folder if affected
    if (autoSave.selectedId) {
      if (autoSave.folder === oldPath || autoSave.folder.startsWith(oldPath + "/")) {
        const newFolder = newPath + autoSave.folder.slice(oldPath.length);
        autoSave.updateFolderSilently(newFolder);
      }
    }

    await fetchMemos();
  };

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
                selectedId={autoSave.selectedId}
                focusedSidebarItem={focusedSidebarItem}
                onFocusSidebarItem={setFocusedSidebarItem}
                getOrderedChildren={buildOrderedChildren}
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
            createdAt={autoSave.createdAt}
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
