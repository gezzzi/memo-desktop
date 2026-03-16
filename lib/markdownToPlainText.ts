import { useEffect, useRef, type RefObject } from "react";

/**
 * Convert markdown text to plain text.
 */
export function markdownToPlainText(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Toggle fenced code block
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Preserve code block content as-is
    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    let converted = line;

    // Table separator rows — remove entirely
    if (/^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|?\s*$/.test(converted)) {
      continue;
    }

    // Table rows — strip pipes
    if (/^\|(.+)\|/.test(converted)) {
      converted = converted
        .replace(/^\|\s*/, "")
        .replace(/\s*\|?\s*$/, "")
        .replace(/\s*\|\s*/g, "  ");
    }

    // Horizontal rules
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(converted)) {
      result.push("");
      continue;
    }

    // Headings
    converted = converted.replace(/^(#{1,6})\s+(.*)$/, "$2");

    // Images ![alt](url) → alt
    converted = converted.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

    // Links [text](url) → text
    converted = converted.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // Bold+italic ***text*** or ___text___
    converted = converted.replace(/\*{3}(.+?)\*{3}/g, "$1");
    converted = converted.replace(/_{3}(.+?)_{3}/g, "$1");

    // Bold **text** or __text__
    converted = converted.replace(/\*{2}(.+?)\*{2}/g, "$1");
    converted = converted.replace(/_{2}(.+?)_{2}/g, "$1");

    // Italic *text* or _text_
    converted = converted.replace(/\*(.+?)\*/g, "$1");
    converted = converted.replace(/(?<!\w)_(.+?)_(?!\w)/g, "$1");

    // Strikethrough ~~text~~
    converted = converted.replace(/~~(.+?)~~/g, "$1");

    // Inline code `code`
    converted = converted.replace(/`([^`]+)`/g, "$1");

    // Blockquotes > text (handle nested >>)
    converted = converted.replace(/^(\s*)>+\s?/, "$1");

    // Simple HTML tags
    converted = converted.replace(/<\/?[a-zA-Z][^>]*>/g, "");

    result.push(converted);
  }

  return result
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Hook: Ctrl+Shift+V to paste with markdown stripped.
 * Tracks Shift key state and intercepts the paste event.
 */
export function usePlainPaste(
  ref: RefObject<HTMLTextAreaElement | null>,
  currentValue: string,
  setValue: (newValue: string) => void
): void {
  const shiftRef = useRef(false);
  const valueRef = useRef(currentValue);
  valueRef.current = currentValue;
  const setValueRef = useRef(setValue);
  setValueRef.current = setValue;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") shiftRef.current = false;
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!shiftRef.current) return;

      e.preventDefault();
      const clipText = e.clipboardData?.getData("text/plain") ?? "";
      if (!clipText) return;

      const converted = markdownToPlainText(clipText);
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const cur = valueRef.current;
      const newValue = cur.slice(0, start) + converted + cur.slice(end);
      setValueRef.current(newValue);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + converted.length;
      });
    };

    el.addEventListener("keydown", onKeyDown);
    el.addEventListener("keyup", onKeyUp);
    el.addEventListener("paste", onPaste);
    return () => {
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("paste", onPaste);
    };
  }, [ref]);
}
