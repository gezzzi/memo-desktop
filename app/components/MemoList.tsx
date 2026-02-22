"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { MemoSummary } from "@/lib/types";

interface ContextMenu {
  x: number;
  y: number;
  type: "memo" | "folder" | "background";
  id: string;
  name: string;
}

interface MemoListProps {
  memos: MemoSummary[];
  allFolderPaths: string[];
  topLevelFolders: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMoveToFolder: (memoId: string, folder: string) => void;
  onMoveFolderIntoFolder: (src: string, target: string) => void;
  onDeleteMemo: (id: string, name: string) => void;
  onDeleteFolder: (path: string, name: string) => void;
  onNewMemo: (folder: string) => void;
  onNewFolder: (parentPath: string) => void;
}

export default function MemoList({
  memos,
  allFolderPaths,
  topLevelFolders,
  selectedId,
  onSelect,
  onMoveToFolder,
  onMoveFolderIntoFolder,
  onDeleteMemo,
  onDeleteFolder,
  onNewMemo,
  onNewFolder,
}: MemoListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the menu after it renders, adjusting for screen edges
  const adjustMenuPosition = useCallback(() => {
    if (!menuRef.current || !contextMenu) return;
    const rect = menuRef.current.getBoundingClientRect();
    let { x, y } = contextMenu;
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 4;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 4;
    if (x < 0) x = 4;
    if (y < 0) y = 4;
    setMenuPos({ left: x, top: y });
  }, [contextMenu]);

  useEffect(() => {
    adjustMenuPosition();
  }, [adjustMenuPosition]);

  // Close context menu on click outside or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const getChildFolderNames = (parentPath: string): string[] => {
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
  };

  const getMemosInFolder = (folderPath: string): MemoSummary[] =>
    memos.filter((m) => m.folder === folderPath);

  const getRootMemos = (): MemoSummary[] =>
    memos.filter((m) => !m.folder);

  const handleDrop = (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    const memoId = e.dataTransfer.getData("memo-id");
    const folderPath = e.dataTransfer.getData("folder-path");
    if (memoId) onMoveToFolder(memoId, targetFolder);
    else if (folderPath) onMoveFolderIntoFolder(folderPath, targetFolder);
  };

  const openContextMenu = (
    e: React.MouseEvent,
    type: "memo" | "folder" | "background",
    id: string,
    name: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id, name });
  };

  const renderFolder = (path: string, name: string, depth: number) => {
    const isOpen = expanded.has(path);
    const children = getChildFolderNames(path);
    const folderMemos = getMemosInFolder(path);

    return (
      <div key={path}>
        {/* Folder row */}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("folder-path", path);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setDragOverPath(path);
          }}
          onDrop={(e) => handleDrop(e, path)}
          onClick={() => toggleExpanded(path)}
          onContextMenu={(e) => openContextMenu(e, "folder", path, name)}
          className={`w-full flex items-center gap-1 h-[22px] pr-2 text-[13px] cursor-pointer select-none ${
            dragOverPath === path
              ? "bg-foreground/10"
              : "hover:bg-foreground/[0.06]"
          }`}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {/* Chevron */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 text-foreground/50 transition-transform duration-100 ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {/* Folder icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted/60"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <span className="truncate text-foreground/80">{name}</span>
        </div>

        {/* Expanded children */}
        {isOpen && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              setDragOverPath(path);
            }}
            onDrop={(e) => handleDrop(e, path)}
          >
            {children.map((childName) =>
              renderFolder(`${path}/${childName}`, childName, depth + 1)
            )}
            {folderMemos.map((memo) => renderMemo(memo, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderMemo = (memo: MemoSummary, depth: number) => {
    const isSelected = selectedId === memo.id;
    return (
      <div
        key={memo.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("memo-id", memo.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => onSelect(memo.id)}
        onContextMenu={(e) => openContextMenu(e, "memo", memo.id, memo.title)}
        className={`w-full flex items-center gap-1 h-[22px] pr-2 text-[13px] cursor-pointer select-none ${
          isSelected
            ? "bg-foreground/10 text-foreground"
            : "hover:bg-foreground/[0.06] text-foreground/80"
        }`}
        style={{ paddingLeft: 8 + depth * 16 + 14 }}
      >
        {/* File icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-muted/60"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="truncate">{memo.title}</span>
      </div>
    );
  };

  const rootMemos = getRootMemos();

  if (memos.length === 0 && allFolderPaths.length === 0) {
    return (
      <div
        className="px-3 py-6 text-[13px] text-muted min-h-full"
        onContextMenu={(e) => openContextMenu(e, "background", "", "")}
      >
        メモがありません
      </div>
    );
  }

  return (
    <>
      <div
        className="flex flex-col py-0.5 min-h-full"
        onContextMenu={(e) => {
          // Only handle if not already handled by a child (folder/memo row)
          if (!e.defaultPrevented) {
            openContextMenu(e, "background", "", "");
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOverPath(null);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverPath(null);
          }
        }}
        onDrop={(e) => handleDrop(e, "")}
      >
        {topLevelFolders.map((f) => renderFolder(f, f, 0))}
        {rootMemos.map((memo) => renderMemo(memo, 0))}
      </div>

      {/* Context menu - rendered via portal to escape sidebar overflow/backdrop */}
      {contextMenu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] bg-surface rounded-lg shadow-lg ring-1 ring-border-strong py-1 min-w-[160px]"
          style={{ left: menuPos.left, top: menuPos.top }}
        >
          {/* New file */}
          <button
            onClick={() => {
              onNewMemo(contextMenu.type === "folder" ? contextMenu.id : "");
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-foreground/80 hover:bg-foreground/5 flex items-center gap-2 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            新規ファイル
          </button>
          {/* New folder */}
          <button
            onClick={() => {
              onNewFolder(contextMenu.type === "folder" ? contextMenu.id : "");
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-foreground/80 hover:bg-foreground/5 flex items-center gap-2 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              <line x1="12" y1="10" x2="12" y2="16" />
              <line x1="9" y1="13" x2="15" y2="13" />
            </svg>
            新規フォルダ
          </button>
          {contextMenu.type !== "background" && (
            <>
              {/* Separator */}
              <div className="h-px bg-border mx-2 my-1" />
              {/* Delete */}
              <button
                onClick={() => {
                  if (contextMenu.type === "memo") {
                    onDeleteMemo(contextMenu.id, contextMenu.name);
                  } else {
                    onDeleteFolder(contextMenu.id, contextMenu.name);
                  }
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-500/10 flex items-center gap-2 text-red-500 dark:text-red-400 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                削除
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
