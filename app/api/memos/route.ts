import { NextRequest, NextResponse } from "next/server";
import { listMemos, createMemo } from "@/lib/memos";

export async function GET() {
  const memos = await listMemos();
  return NextResponse.json({ memos });
}

export async function POST(request: NextRequest) {
  const { title, body, folder } = await request.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const memo = await createMemo(title.trim(), body ?? "", folder ?? "");
  return NextResponse.json(memo, { status: 201 });
}
