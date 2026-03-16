"use client";

import { useState, useRef } from "react";
import type { SaveStatus } from "@/app/hooks/useAutoSaveMemo";
import { usePlainPaste } from "@/lib/markdownToPlainText";

interface MemoEditorProps {
  title: string;
  body: string;
  folder: string;
  createdAt: string;
  isNew: boolean;
  hasSelection: boolean;
  allFolders: string[];
  saveStatus: SaveStatus;
  onChange: (field: "title" | "body", value: string) => void;
  onFolderChange: (folder: string) => void;
  onDelete: () => void;
  onNew: () => void;
}

export default function MemoEditor({
  title,
  body,
  folder,
  createdAt,
  isNew,
  hasSelection,
  allFolders,
  saveStatus,
  onChange,
  onFolderChange,
  onDelete,
  onNew,
}: MemoEditorProps) {
  const [folderInput, setFolderInput] = useState("");
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  usePlainPaste(bodyRef, body, (v) => onChange("body", v));

  const handleFolderSelect = (f: string) => {
    onFolderChange(f);
    setFolderInput("");
    setShowFolderDropdown(false);
  };

  const handleFolderInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter" && folderInput.trim()) {
      e.preventDefault();
      onFolderChange(folderInput.trim());
      setFolderInput("");
      setShowFolderDropdown(false);
    }
  };

  // Empty state
  if (!hasSelection && !isNew) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <button
          onClick={onNew}
          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-accent text-surface shadow-sm hover:bg-accent-hover active:scale-95 transition-all duration-150"
          aria-label="New memo"
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
        <span className="text-sm text-muted">
          メモを選択するか、新しいメモを作成
        </span>
      </div>
    );
  }

  const filteredFolders = allFolders.filter(
    (f) =>
      f !== folder &&
      (!folderInput || f.toLowerCase().includes(folderInput.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col bg-surface rounded-2xl shadow-sm ring-1 ring-border-strong overflow-hidden">
          {/* Title row with status and actions */}
          <div className="flex items-center gap-2 border-b border-border">
            <input
              type="text"
              value={title}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="タイトル"
              spellCheck={false}
              className="flex-1 min-w-0 px-5 py-3.5 text-base font-semibold bg-transparent outline-none placeholder:text-muted/50"
            />
            <div className="flex items-center gap-1 pr-3 shrink-0">
              {/* Save status */}
              <span
                className={`text-[11px] mr-1 transition-opacity duration-300 ${
                  saveStatus === "saving"
                    ? "text-muted animate-pulse"
                    : saveStatus === "saved"
                    ? "text-muted"
                    : saveStatus === "error"
                    ? "text-red-500 dark:text-red-400"
                    : "opacity-0"
                }`}
              >
                {saveStatus === "saving"
                  ? "保存中..."
                  : saveStatus === "saved"
                  ? "保存済み"
                  : saveStatus === "error"
                  ? "保存エラー"
                  : ""}
              </span>

              {/* Delete */}
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                aria-label="削除"
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

          {/* Folder select + Created date */}
          <div className="relative flex items-center gap-2 px-5 py-2.5 border-b border-border">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
              className="text-foreground/90 shrink-0"
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            {folder ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-lg bg-surface-secondary text-foreground/70">
                {folder}
                <button
                  onClick={() => onFolderChange("")}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            ) : (
              <input
                type="text"
                value={folderInput}
                onChange={(e) => {
                  setFolderInput(e.target.value);
                  setShowFolderDropdown(true);
                }}
                onFocus={() => setShowFolderDropdown(true)}
                onBlur={() =>
                  setTimeout(() => setShowFolderDropdown(false), 150)
                }
                onKeyDown={handleFolderInputKeyDown}
                placeholder="フォルダを選択..."
                className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted/50 py-0.5"
              />
            )}
            {/* Created date - right aligned */}
            {createdAt && (
              <span className="ml-auto text-xs text-muted shrink-0">{createdAt}</span>
            )}
            {showFolderDropdown && !folder && filteredFolders.length > 0 && (
              <div className="absolute left-0 top-full mt-1 ml-5 bg-surface rounded-xl shadow-lg ring-1 ring-border-strong z-10 py-1 min-w-[160px]">
                {filteredFolders.map((f) => (
                  <button
                    key={f}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFolderSelect(f)}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground/70 hover:bg-foreground/5 transition-colors"
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => onChange("body", e.target.value)}
            placeholder="メモを入力..."
            spellCheck={false}
            className="w-full flex-1 px-5 py-3.5 bg-transparent outline-none resize-none text-base leading-relaxed placeholder:text-muted/50"
          />
        </div>
      </div>
    </div>
  );
}
