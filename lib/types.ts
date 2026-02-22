export interface Memo {
  id: string;
  title: string;
  body: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoSummary {
  id: string;
  title: string;
  folder: string;
  updatedAt: string;
}
