"use client";

import { useState } from "react";

export default function ScratchPad() {
  const [text, setText] = useState("");

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col bg-surface rounded-2xl shadow-sm ring-1 ring-border-strong overflow-hidden">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="一時メモ（リロードで消えます）"
            className="w-full flex-1 px-5 py-3.5 bg-transparent outline-none resize-none text-base leading-relaxed placeholder:text-muted/50"
          />
        </div>
      </div>
    </div>
  );
}
