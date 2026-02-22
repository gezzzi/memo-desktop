import { NextRequest, NextResponse } from "next/server";
import { getMemo, updateMemo, deleteMemo } from "@/lib/memos";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const memo = await getMemo(id);
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(memo);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { title, body, folder } = await request.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const memo = await updateMemo(id, title.trim(), body ?? "", folder ?? "");
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(memo);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteMemo(id);
  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
