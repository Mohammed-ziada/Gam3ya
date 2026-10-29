"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { CircleDollarSign, Pencil, Trash2, X } from "lucide-react";

type ModalState = { saved: number; error: string | null };

export function EditModal({
  title,
  description,
  triggerLabel,
  submitLabel = "حفظ التعديل",
  action,
  children,
  wide = false,
  kind = "edit",
  submitDisabled = false,
}: {
  title: string;
  description?: string;
  triggerLabel: string;
  submitLabel?: string;
  action: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
  wide?: boolean;
  kind?: "edit" | "payment" | "danger";
  submitDisabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState<ModalState, FormData>(async (_previous, formData) => {
    try {
      await action(formData);
      return { saved: _previous.saved + 1, error: null };
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
      return { saved: _previous.saved, error: error instanceof Error ? error.message : "تعذر حفظ التعديل" };
    }
  }, { saved: 0, error: null });

  useEffect(() => {
    if (state.saved > 0) dialogRef.current?.close();
  }, [state.saved]);

  return <>
    <button type="button" className="edit-trigger" onClick={() => dialogRef.current?.showModal()}>
      {kind === "payment" ? <CircleDollarSign size={16} /> : kind === "danger" ? <Trash2 size={16} /> : <Pencil size={15} />} {triggerLabel}
    </button>
    <dialog
      ref={dialogRef}
      className={`edit-modal${wide ? " wide" : ""}`}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="modal-sheet">
        <div className="modal-handle" aria-hidden="true" />
        <header className="modal-header">
          <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
          <button type="button" className="modal-close" aria-label="إغلاق" onClick={() => dialogRef.current?.close()}><X size={21} /></button>
        </header>
        <form action={formAction} className="stack-form modal-form">
          {children}
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
          <div className="modal-actions">
            <button type="button" className="button ghost" onClick={() => dialogRef.current?.close()}>إلغاء</button>
            <button type="submit" className={`button ${kind === "danger" ? "danger-solid" : "primary"}`} disabled={pending || submitDisabled}>{pending ? "جاري الحفظ..." : submitLabel}</button>
          </div>
        </form>
      </div>
    </dialog>
  </>;
}
