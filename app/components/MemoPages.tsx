"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { MemoPage } from "@/lib/types";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

interface MemoPagesProps {
  memoId: string | null;
  pages: MemoPage[];
  hasSelection: boolean;
  onAddPage: () => string;
  onDeletePage: (id: string) => void;
  onPageTitleChange: (id: string, title: string) => void;
  onPageBodyChange: (id: string, body: string) => void;
}

interface ContextMenu {
  x: number;
  y: number;
  pageId: string;
}

const LAST_PAGE_KEY = "memo-last-page";

export default function MemoPages({
  memoId,
  pages,
  hasSelection,
  onAddPage,
  onDeletePage,
  onPageTitleChange,
  onPageBodyChange,
}: MemoPagesProps) {
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Restore active page from localStorage, or fall back to first page
  useEffect(() => {
    if (pages.length === 0) {
      setActivePageId(null);
      return;
    }
    const saved = localStorage.getItem(LAST_PAGE_KEY);
    if (saved && pages.some((p) => p.id === saved)) {
      setActivePageId(saved);
    } else {
      setActivePageId(pages[0].id);
    }
  }, [memoId, pages.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist active page to localStorage
  useEffect(() => {
    if (activePageId) {
      localStorage.setItem(LAST_PAGE_KEY, activePageId);
    }
  }, [activePageId]);

  // If active page was deleted, select neighbor
  useEffect(() => {
    if (pages.length > 0 && activePageId && !pages.some((p) => p.id === activePageId)) {
      setActivePageId(pages[0].id);
    }
  }, [pages, activePageId]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingTabId]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu]);

  const activePage = pages.find((p) => p.id === activePageId) ?? null;

  const deleteTargetIndex = deleteTargetId
    ? pages.findIndex((p) => p.id === deleteTargetId)
    : -1;
  const deleteTargetName = deleteTargetId
    ? pages[deleteTargetIndex]?.title || `ページ ${deleteTargetIndex + 2}`
    : "";

  const handleAddPage = () => {
    const newId = onAddPage();
    setActivePageId(newId);
  };

  const confirmDeletePage = () => {
    if (!deleteTargetId) return;
    if (activePageId === deleteTargetId) {
      const idx = pages.findIndex((p) => p.id === deleteTargetId);
      const next = pages[idx + 1] ?? pages[idx - 1] ?? null;
      setActivePageId(next?.id ?? null);
    }
    onDeletePage(deleteTargetId);
    setDeleteTargetId(null);
  };

  const startEditing = useCallback((pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const idx = pages.findIndex((p) => p.id === pageId);
    setEditingTabId(pageId);
    setEditingName(page.title || `ページ ${idx + 2}`);
  }, [pages]);

  const commitEditing = () => {
    if (editingTabId) {
      const page = pages.find((p) => p.id === editingTabId);
      const idx = pages.findIndex((p) => p.id === editingTabId);
      const defaultLabel = `ページ ${idx + 2}`;
      const trimmed = editingName.trim();
      const newTitle = trimmed === defaultLabel ? "" : trimmed;
      if (page && newTitle !== page.title) {
        onPageTitleChange(editingTabId, newTitle);
      }
    }
    setEditingTabId(null);
    setEditingName("");
  };

  const getTabLabel = (page: MemoPage, index: number) => {
    return page.title || `ページ ${index + 2}`;
  };

  const handleContextMenu = (e: React.MouseEvent, pageId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, pageId });
  };

  // Empty state: no memo selected
  if (!hasSelection) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <span className="text-sm text-muted">
          メモを選択してページを追加
        </span>
      </div>
    );
  }

  // No pages yet
  if (pages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <button
          onClick={handleAddPage}
          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-accent text-surface shadow-sm hover:bg-accent-hover active:scale-95 transition-all duration-150"
          aria-label="ページを追加"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <span className="text-sm text-muted">ページを追加</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col bg-surface rounded-2xl shadow-sm ring-1 ring-border-strong overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center border-b border-border">
            <div className="flex items-center px-3 h-11 gap-1 overflow-x-auto flex-1 min-w-0">
              {pages.map((page, i) =>
                editingTabId === page.id ? (
                  <form
                    key={page.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitEditing();
                    }}
                    className="shrink-0"
                  >
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={commitEditing}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setEditingTabId(null);
                          setEditingName("");
                        }
                      }}
                      spellCheck={false}
                      className="w-28 px-3 py-1.5 text-xs rounded-lg bg-surface ring-1 ring-accent outline-none"
                    />
                  </form>
                ) : (
                  <button
                    key={page.id}
                    onClick={() => setActivePageId(page.id)}
                    onContextMenu={(e) => handleContextMenu(e, page.id)}
                    className={`relative px-3.5 py-1.5 text-xs rounded-lg shrink-0 transition-all duration-150 ${
                      activePageId === page.id
                        ? "bg-foreground/[0.08] text-foreground font-medium shadow-sm ring-1 ring-foreground/[0.06]"
                        : "text-muted hover:text-foreground/70 hover:bg-foreground/[0.04]"
                    }`}
                  >
                    {getTabLabel(page, i)}
                  </button>
                )
              )}
              {/* Add page */}
              <button
                onClick={handleAddPage}
                className="p-1.5 rounded-lg shrink-0 text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                aria-label="ページを追加"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            {/* Delete */}
            <div className="flex items-center pr-3 shrink-0">
              <button
                onClick={() => {
                  if (activePageId) setDeleteTargetId(activePageId);
                }}
                className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label="ページを削除"
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
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Page content */}
          {activePage && (
            <textarea
              value={activePage.body}
              onChange={(e) => onPageBodyChange(activePage.id, e.target.value)}
              placeholder="ページの内容を入力..."
              spellCheck={false}
              className="w-full flex-1 px-5 py-3.5 bg-transparent outline-none resize-none text-base leading-relaxed placeholder:text-muted/50"
            />
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-[100] bg-surface rounded-xl shadow-lg ring-1 ring-border-strong py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              startEditing(contextMenu.pageId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-foreground/5 transition-colors flex items-center gap-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            名前を変更
          </button>
          <button
            onClick={() => {
              setDeleteTargetId(contextMenu.pageId);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition-colors flex items-center gap-2"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            削除
          </button>
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={deleteTargetId !== null}
        title="ページを削除しますか？"
        message={`「${deleteTargetName}」を削除します。この操作は元に戻せません。`}
        onConfirm={confirmDeletePage}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
