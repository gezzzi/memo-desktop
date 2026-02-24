import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { Memo, MemoSummary } from "./types";

const MEMOS_DIR = path.join(process.cwd(), "memos");
const ID_PATTERN = /^[a-f0-9-]{36}$/;
const FOLDER_PATTERN = /^\[folder:(.*)\]$/;
const CREATED_PATTERN = /^\[created:(.*)\]$/;

async function ensureMemosDir() {
  await fs.mkdir(MEMOS_DIR, { recursive: true });
}

function validateId(id: string): boolean {
  return ID_PATTERN.test(id);
}

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseMemoFile(content: string): {
  title: string;
  body: string;
  folder: string;
  createdAt: string;
} {
  const lines = content.split("\n");
  const title = (lines[0] ?? "").replace(/\r$/, "");

  let folder = "";
  let createdAt = "";
  let bodyStart = 1;

  // Parse metadata lines after title
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    const folderMatch = line.match(FOLDER_PATTERN);
    if (folderMatch) {
      folder = folderMatch[1].trim();
      bodyStart = i + 1;
      continue;
    }
    const createdMatch = line.match(CREATED_PATTERN);
    if (createdMatch) {
      createdAt = createdMatch[1].trim();
      bodyStart = i + 1;
      continue;
    }
    break;
  }

  const body = lines.slice(bodyStart).join("\n");
  return { title, body, folder, createdAt };
}

function serializeMemo(
  title: string,
  body: string,
  folder: string,
  createdAt: string
): string {
  const parts = [title];
  if (createdAt) {
    parts.push(`[created:${createdAt}]`);
  }
  if (folder) {
    parts.push(`[folder:${folder}]`);
  }
  if (body) {
    parts.push(body);
  }
  return parts.join("\n");
}

export async function listMemos(): Promise<MemoSummary[]> {
  await ensureMemosDir();
  const files = await fs.readdir(MEMOS_DIR);
  const txtFiles = files.filter((f) => f.endsWith(".txt"));

  const memos = await Promise.all(
    txtFiles.map(async (file) => {
      const filePath = path.join(MEMOS_DIR, file);
      const [content, stat] = await Promise.all([
        fs.readFile(filePath, "utf-8"),
        fs.stat(filePath),
      ]);
      const { title, folder, createdAt } = parseMemoFile(content);
      return {
        id: file.replace(/\.txt$/, ""),
        title: title || "無題",
        folder,
        createdAt,
        updatedAt: stat.mtime.toISOString(),
      };
    })
  );

  return memos.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getMemo(id: string): Promise<Memo | null> {
  if (!validateId(id)) return null;
  await ensureMemosDir();

  const filePath = path.join(MEMOS_DIR, `${id}.txt`);
  try {
    const [content, stat] = await Promise.all([
      fs.readFile(filePath, "utf-8"),
      fs.stat(filePath),
    ]);
    const { title, body, folder, createdAt } = parseMemoFile(content);
    return {
      id,
      title: title || "無題",
      body,
      folder,
      createdAt,
      updatedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function createMemo(
  title: string,
  body: string,
  folder: string
): Promise<Memo> {
  await ensureMemosDir();

  const id = crypto.randomUUID();
  const filePath = path.join(MEMOS_DIR, `${id}.txt`);
  const createdAt = todayString();
  const content = serializeMemo(title, body, folder, createdAt);

  await fs.writeFile(filePath, content, "utf-8");
  const stat = await fs.stat(filePath);

  return {
    id,
    title,
    body,
    folder,
    createdAt,
    updatedAt: stat.mtime.toISOString(),
  };
}

export async function updateMemo(
  id: string,
  title: string,
  body: string,
  folder: string
): Promise<Memo | null> {
  if (!validateId(id)) return null;
  await ensureMemosDir();

  const filePath = path.join(MEMOS_DIR, `${id}.txt`);
  let existingCreatedAt = "";
  try {
    const existingContent = await fs.readFile(filePath, "utf-8");
    existingCreatedAt = parseMemoFile(existingContent).createdAt;
  } catch {
    return null;
  }

  const content = serializeMemo(title, body, folder, existingCreatedAt);
  await fs.writeFile(filePath, content, "utf-8");
  const stat = await fs.stat(filePath);

  return {
    id,
    title,
    body,
    folder,
    createdAt: existingCreatedAt,
    updatedAt: stat.mtime.toISOString(),
  };
}

export async function deleteMemo(id: string): Promise<boolean> {
  if (!validateId(id)) return false;
  await ensureMemosDir();

  const filePath = path.join(MEMOS_DIR, `${id}.txt`);
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
