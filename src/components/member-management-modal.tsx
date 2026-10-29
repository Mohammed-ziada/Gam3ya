"use client";

import { useActionState, useId, useRef } from "react";
import { Link2, Power, Settings2, Trash2, X } from "lucide-react";
import type { MemberManagementState } from "@/actions/associations";

const initialState: MemberManagementState = { saved: 0, message: null, error: null };

export function MemberManagementModal({
  memberId,
  associationId,
  name,
  active,
  action,
}: {
  memberId: string;
  associationId: string;
  name: string;
  active: boolean;
  action: (previous: MemberManagementState, formData: FormData) => Promise<MemberManagementState>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(action, initialState);

  return <>
    <button type="button" className="edit-trigger" onClick={() => dialogRef.current?.showModal()}><Settings2 size={16} /> إدارة الفرد</button>
    <dialog ref={dialogRef} className="edit-modal" aria-labelledby={titleId} onClick={(event) => {
      if (event.target === event.currentTarget) event.currentTarget.close();
    }}>
      <div className="modal-sheet">
        <div className="modal-handle" aria-hidden="true" />
        <header className="modal-header"><div><h2 id={titleId}>إدارة {name}</h2><p>تحكم في الرابط وحالة الفرد أو احذفه نهائيًا.</p></div><button type="button" className="modal-close" aria-label="إغلاق" onClick={() => dialogRef.current?.close()}><X size={21} /></button></header>
        <form action={formAction} className="management-form">
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="associationId" value={associationId} />

          <section className="management-block"><div><span className={`status-pill ${active ? "active" : "paused"}`}>{active ? "الرابط مفعّل" : "الرابط متوقف"}</span><h3>صلاحية الرابط</h3><p>الإيقاف مؤقت ويحافظ على كل الدفعات والبيانات.</p></div><button className="button ghost" name="operation" value="toggle-active" disabled={pending}><Power size={17} /> {active ? "إيقاف الرابط" : "تفعيل الرابط"}</button></section>

          <section className="management-block"><div><h3>إنشاء رابط جديد</h3><p>الرابط الحالي سيتوقف فورًا، وتظل بيانات الفرد كما هي.</p></div><button className="button ghost" name="operation" value="regenerate-link" disabled={pending} onClick={(event) => { if (!window.confirm("إنشاء رابط جديد وإلغاء الرابط الحالي؟")) event.preventDefault(); }}><Link2 size={17} /> رابط جديد</button></section>

          <section className="management-block danger-zone"><div><h3>حذف الفرد نهائيًا</h3><p>سيتم حذف أسهمه ودفعاته وإثباتاته. اكتب <b>{name}</b> للتأكيد.</p></div><input name="confirmation" placeholder={name} autoComplete="off" /><button className="button danger-solid" name="operation" value="delete" disabled={pending}><Trash2 size={17} /> حذف الفرد</button></section>

          {state.message && <p className="form-success" role="status">{state.message}</p>}
          {state.error && <p className="form-error" role="alert">{state.error}</p>}
        </form>
      </div>
    </dialog>
  </>;
}
