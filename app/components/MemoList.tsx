"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { MemoSummary, FocusedSidebarItem } from "@/lib/types";

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
  selectedId: string | null;
  focusedSidebarItem: FocusedSidebarItem;
  onFocusSidebarItem: (item: FocusedSidebarItem) => void;
  getOrderedChildren: (scope: string) => { folders: string[]; memos: MemoSummary[] };
  onSelect: (id: string) => void;
  onMoveToFolder: (memoId: string, folder: string) => void;
  onMoveFolderIntoFolder: (src: string, target: string) => void;
  onDeleteMemo: (id: string, name: string) => void;
  onDeleteFolder: (path: string, name: string) => void;
  onNewMemo: (folder: string) => void;
  onNewFolder: (parentPath: string) => void;
  onRenameFolder: (oldPath: string, newName: string) => void;
}

export default function MemoList({
  memos,
  allFolderPaths,
  selectedId,
  focusedSidebarItem,
  onFocusSidebarItem,
  getOrderedChildren,
  onSelect,
  onMoveToFolder,
  onMoveFolderIntoFolder,
  onDeleteMemo,
  onDeleteFolder,
  onNewMemo,
  onNewFolder,
  onRenameFolder,
}: MemoListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  const commitRename = () => {
    if (!renamingFolder) return;
    const newName = renameValue.trim();
    if (newName && newName !== renamingFolder.split("/").pop()) {
      onRenameFolder(renamingFolder, newName);
    }
    setRenamingFolder(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingFolder(null);
    setRenameValue("");
  };

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
    const isFocused = focusedSidebarItem?.type === "folder" && focusedSidebarItem.path === path;

    return (
      <div key={path}>
        {/* Folder row */}
        <div
          tabIndex={0}
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
          onClick={() => {
            onFocusSidebarItem({ type: "folder", path });
            toggleExpanded(path);
          }}
          onContextMenu={(e) => openContextMenu(e, "folder", path, name)}
          className={`w-full flex items-center gap-1 h-7 pr-2 text-xs cursor-pointer select-none outline-none ${
            dragOverPath === path
              ? "bg-foreground/10"
              : isFocused
              ? "ring-1 ring-inset ring-accent/50"
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
            className={`shrink-0 text-foreground/90 transition-transform duration-100 ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {/* Folder icon (filled) */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            className="shrink-0 text-foreground/90"
          >
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          {renamingFolder === path ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  cancelRename();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full min-w-0 px-0.5 py-0 text-xs bg-surface ring-1 ring-border-strong rounded outline-none text-foreground"
              autoFocus
            />
          ) : (
            <span className="truncate text-foreground">{name}</span>
          )}
        </div>

        {/* Expanded children */}
        {isOpen && (() => {
          const { folders: childFolders, memos: childMemos } = getOrderedChildren(path);
          return (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                setDragOverPath(path);
              }}
              onDrop={(e) => handleDrop(e, path)}
            >
              {childFolders.map((childName) =>
                renderFolder(`${path}/${childName}`, childName, depth + 1)
              )}
              {childMemos.map((memo) => renderMemo(memo, depth + 1))}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderMemo = (memo: MemoSummary, depth: number) => {
    const isSelected = selectedId === memo.id;
    const isFocused = focusedSidebarItem?.type === "memo" && focusedSidebarItem.id === memo.id;
    return (
      <div
        key={memo.id}
        tabIndex={0}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("memo-id", memo.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => {
          onSelect(memo.id);
          onFocusSidebarItem({ type: "memo", id: memo.id });
        }}
        onContextMenu={(e) => openContextMenu(e, "memo", memo.id, memo.title)}
        className={`w-full flex items-center gap-1 h-7 pr-2 text-xs cursor-pointer select-none outline-none ${
          isSelected
            ? isFocused
              ? "bg-foreground/10 text-foreground ring-1 ring-inset ring-accent/50"
              : "bg-foreground/10 text-foreground"
            : isFocused
            ? "ring-1 ring-inset ring-accent/50 text-foreground"
            : "hover:bg-foreground/[0.06] text-foreground"
        }`}
        style={{ paddingLeft: 8 + depth * 16 + 14 }}
      >
        {/* File icon */}
        <svg
          width="12"
          height="12"
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
        <span className="truncate">{memo.title}</span>
      </div>
    );
  };

  const { folders: rootFolders, memos: rootMemos } = getOrderedChildren("");

  if (memos.length === 0 && allFolderPaths.length === 0) {
    return (
      <div
        className="px-3 py-6 text-xs text-muted min-h-full"
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
        {rootFolders.map((f) => renderFolder(f, f, 0))}
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            新規フォルダ
          </button>
          {contextMenu.type === "folder" && (
            <>
              {/* Rename folder */}
              <button
                onClick={() => {
                  const path = contextMenu.id;
                  const currentName = path.split("/").pop() || path;
                  setRenamingFolder(path);
                  setRenameValue(currentName);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-foreground/80 hover:bg-foreground/5 flex items-center gap-2 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
                </svg>
                名前を変更
              </button>
            </>
          )}
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
