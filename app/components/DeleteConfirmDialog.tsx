"use client";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-surface rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 ring-1 ring-border-strong">
        <h3 className="text-base font-semibold text-foreground mb-1.5">
          {title}
        </h3>
        <p className="text-sm text-muted mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm rounded-xl hover:bg-foreground/5 active:bg-foreground/10 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-1.5 text-sm font-medium rounded-xl bg-red-500 text-white shadow-sm hover:bg-red-600 active:scale-[0.97] transition-all duration-150"
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
