/**
 * Detect if text contains markdown formatting.
 * Uses a confidence threshold to avoid false positives.
 */
export function containsMarkdown(text: string): boolean {
  // High confidence patterns — one match is enough
  const highPatterns = [
    /\[.+?\]\(.+?\)/,              // [text](url) links
    /!\[.*?\]\(.+?\)/,             // ![alt](url) images
    /^```/m,                       // fenced code blocks
    /^\|.+\|.+\|/m,               // table rows
  ];

  for (const p of highPatterns) {
    if (p.test(text)) return true;
  }

  // Normal patterns — need 2+ matches
  const normalPatterns = [
    /^#{1,6}\s+\S/m,              // ATX headings
    /\*{1,3}\S.*?\S?\*{1,3}/,     // bold/italic with *
    /_{1,3}\S.*?\S?_{1,3}/,       // bold/italic with _
    /~~\S.*?\S~~/,                // strikethrough
    /^[\s]*[-*+]\s+\S/m,          // unordered list
    /^>\s+/m,                     // blockquote
    /^(-{3,}|\*{3,}|_{3,})\s*$/m, // horizontal rule
    /`[^`]+`/,                    // inline code
  ];

  let count = 0;
  for (const p of normalPatterns) {
    if (p.test(text)) {
      count++;
      if (count >= 2) return true;
    }
  }

  return false;
}

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
 * Paste handler for textareas.
 * Detects markdown in clipboard and converts to plain text.
 */
export function handleMarkdownPaste(
  e: React.ClipboardEvent<HTMLTextAreaElement>,
  currentValue: string,
  setValue: (newValue: string) => void
): void {
  const clipText = e.clipboardData.getData("text/plain");
  if (!clipText || !containsMarkdown(clipText)) return;

  e.preventDefault();
  const converted = markdownToPlainText(clipText);
  const target = e.currentTarget;
  const start = target.selectionStart;
  const end = target.selectionEnd;
  const newValue =
    currentValue.slice(0, start) + converted + currentValue.slice(end);
  setValue(newValue);
  requestAnimationFrame(() => {
    target.selectionStart = target.selectionEnd = start + converted.length;
  });
}
