export interface MemoPage {
  id: string;
  title: string;
  body: string;
}

export interface Memo {
  id: string;
  title: string;
  body: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
  pages: MemoPage[];
}

export interface MemoSummary {
  id: string;
  title: string;
  folder: string;
  updatedAt: string;
}

export type FocusedSidebarItem =
  | { type: "folder"; path: string }
  | { type: "memo"; id: string }
  | null;

export interface SidebarOrder {
  [scope: string]: {
    folders?: string[];
    memos?: string[];
  };
}
