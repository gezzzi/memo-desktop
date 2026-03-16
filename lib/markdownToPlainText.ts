import { useEffect, type RefObject } from "react";

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
 * Normal Ctrl+V pastes as-is (default browser behavior).
 */
export function usePlainPaste(
  ref: RefObject<HTMLTextAreaElement | null>,
  currentValue: string,
  setValue: (newValue: string) => void
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+V (or Cmd+Shift+V on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        navigator.clipboard.readText().then((clipText) => {
          if (!clipText) return;
          const converted = markdownToPlainText(clipText);
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const newValue =
            currentValue.slice(0, start) + converted + currentValue.slice(end);
          setValue(newValue);
          requestAnimationFrame(() => {
            el.selectionStart = el.selectionEnd = start + converted.length;
          });
        });
      }
    };

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [ref, currentValue, setValue]);
}
