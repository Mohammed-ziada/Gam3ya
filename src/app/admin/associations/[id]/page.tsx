import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ExternalLink, Plus, WalletCards } from "lucide-react";
import { addMember, associationDetails, deleteAssociation, manageMember, recordManualPayments, reviewSubmission, updateAssociation, updateMember } from "@/actions/associations";
import { CopyLink } from "@/components/copy-link";
import { EditModal } from "@/components/edit-modal";
import { MemberManagementModal } from "@/components/member-management-modal";
import { cycleLabel, formatDate, formatMoney } from "@/lib/format";

export default async function AssociationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await associationDetails(id);
  if (!data) notFound();
  const { association, members, shares, payments, submissions } = data;
  const totalCycles = association.plannedSlots ?? shares.reduce((max, share) => Math.max(max, share.payoutOrder), 0);
  const pot = association.installmentAmount * totalCycles;
  const fullShareCount = shares.reduce((sum, share) => sum + share.sharePercent, 0) / 100;

  return (
    <main className="page-wrap">
      <Link href="/admin" className="back-link"><ArrowRight size={18} /> كل الجمعيات</Link>
      <div className="page-heading"><div><span className={`eyebrow association-status ${association.status}`}>{association.status === "active" ? "جمعية نشطة" : association.status === "paused" ? "متوقفة مؤقتًا" : "جمعية مكتملة"}</span><h1>{association.name}</h1><p className="muted">بدأت {formatDate(association.startDate)} · الدفع يوم {association.paymentDay} من كل شهر</p></div><div className="pot-card"><span>قيمة القبضة الكاملة</span><strong>{formatMoney(pot)}</strong></div></div>
      <nav className="section-tabs" aria-label="أقسام الجمعية"><a href="#summary">الملخص</a><a href="#members">الأفراد</a><a href="#reviews">المراجعات</a><a href="#association-settings">تعديل الجمعية</a></nav>
      <section className="stats-grid compact" id="summary">
        <article className="mini-stat"><span>الأفراد</span><strong>{members.length}</strong></article>
        <article className="mini-stat"><span>إجمالي الأسهم</span><strong>{fullShareCount}</strong></article>
        <article className="mini-stat"><span>دفعات معلّقة</span><strong>{submissions.filter((s) => s.status === "pending").length}</strong></article>
        <article className="mini-stat"><span>مدة الجمعية</span><strong>{totalCycles || "—"} {totalCycles ? "شهر" : ""}</strong></article>
      </section>

      <div className="content-grid">
        <section className="section-card span-2" id="members">
          <div className="section-title"><div><h2>الأفراد والأسهم</h2><p className="muted">كل فرد له رابط واحد حتى لو كان داخل بأكثر من سهم.</p></div></div>
          {members.length === 0 ? <p className="empty-inline">أضف أول فرد من النموذج المجاور.</p> : <div className="member-table">
            {members.map((member) => {
              const ownShares = shares.filter((share) => share.memberId === member.id);
              const ownPayments = payments.filter((payment) => payment.memberId === member.id);
              const paid = ownPayments.filter((payment) => payment.status === "paid").length;
              const sharePercent = ownShares[0]?.sharePercent ?? 100;
              const payable = ownPayments.filter((payment) => ["unpaid", "rejected"].includes(payment.status));
              return <article className={`member-row${member.active ? "" : " inactive"}`} key={member.id}><div className="avatar">{member.name.charAt(0)}</div><div className="member-info"><strong>{member.name}{member.secondaryName ? ` و${member.secondaryName}` : ""}{!member.active && <span className="inline-status">موقوف</span>}</strong><small>{ownShares.length} {ownShares.length === 1 ? "سهم" : "أسهم"} · {sharePercent === 50 ? "نصف سهم" : "سهم كامل"} · دفع {paid} من {totalCycles}</small><div className="chips">{ownShares.map((share) => <span key={share.id}>{share.label}: {cycleLabel(association.startDate, share.payoutOrder)} ({share.sharePercent}%)</span>)}</div><div className="member-inline-actions"><EditModal title={`تسجيل دفعات ${member.name}`} description="اختار شهرًا أو أكثر لتسجيلهم كمدفوعين بدون إثبات تحويل." triggerLabel="تسجيل دفعة" submitLabel="تأكيد الدفع" action={recordManualPayments} kind="payment" submitDisabled={payable.length === 0}><input type="hidden" name="memberId" value={member.id} /><input type="hidden" name="associationId" value={association.id} /><div className="admin-payment-options">{ownPayments.map((payment) => { const selectable = ["unpaid", "rejected"].includes(payment.status); const statusLabel = payment.status === "paid" ? "مدفوع" : payment.status === "pending" ? "قيد المراجعة" : payment.status === "rejected" ? "مرفوض" : "غير مدفوع"; return <label className={`admin-payment-option ${payment.status}`} key={payment.id}><input type="checkbox" name="paymentIds" value={payment.id} disabled={!selectable} /><span><strong>{cycleLabel(association.startDate, payment.cycleNumber)}</strong><small>{formatMoney(payment.amount)}</small></span><em>{statusLabel}</em></label>; })}</div>{payable.length === 0 && <p className="all-set-note">لا توجد شهور متاحة للتسجيل اليدوي.</p>}</EditModal><EditModal title={`تعديل ${member.name}`} description="غيّر البيانات أو أدوار القبض ثم احفظ." triggerLabel="تعديل الفرد والأدوار" action={updateMember}><input type="hidden" name="memberId" value={member.id} /><input type="hidden" name="associationId" value={association.id} /><label>الاسم<input name="name" defaultValue={member.name} required /></label><label>اسم مشارك إضافي <small>(اختياري)</small><input name="secondaryName" defaultValue={member.secondaryName ?? ""} /></label><label>الهاتف<input name="phone" defaultValue={member.phone ?? ""} inputMode="tel" /></label><label>نوع السهم<select name="sharePercent" defaultValue={String(sharePercent)}><option value="100">سهم كامل</option><option value="50">نصف سهم</option></select></label><label>أدوار القبض<input name="payoutOrders" defaultValue={ownShares.map((share) => share.payoutOrder).join("، ")} required /><small>افصل بين الأدوار بفاصلة، مثال: 1، 8</small></label></EditModal><MemberManagementModal memberId={member.id} associationId={association.id} name={member.name} active={member.active} action={manageMember} /></div></div><div className="member-actions"><CopyLink token={member.publicToken} /><Link className="icon-button" href={`/m/${member.publicToken}`} target="_blank"><ExternalLink size={17} /> فتح</Link></div></article>;
            })}
          </div>}
        </section>

        <section className="section-card add-member-card">
          <div className="section-title"><div><h2><Plus size={20} /> إضافة فرد</h2><p className="muted">اكتب كل أدوار القبض لنفس الشخص.</p></div></div>
          <form action={addMember} className="stack-form">
            <input type="hidden" name="associationId" value={association.id} />
            <label>اسم الفرد<input name="name" placeholder="الاسم" required /></label>
            <label>اسم مشارك إضافي <small>(اختياري)</small><input name="secondaryName" placeholder="لو شخصان يستخدمان نفس الرابط" /></label>
            <label>رقم الهاتف <small>(اختياري)</small><input name="phone" inputMode="tel" placeholder="01xxxxxxxxx" /></label>
            <label>نوع السهم<select name="sharePercent" defaultValue="100"><option value="100">سهم كامل — يدفع ويقبض كامل</option><option value="50">نصف سهم — يدفع ويقبض النصف</option></select></label>
            <label>ترتيب القبض<input name="payoutOrders" placeholder="مثال: 1، 8" required /><small>لو له سهمان اكتب الدورين مفصولين بفاصلة.</small></label>
            <button className="button primary full"><Plus size={17} /> إضافة الفرد</button>
          </form>
        </section>
      </div>

      <section className="section-card" id="reviews">
        <div className="section-title"><div><h2>إثباتات بانتظار المراجعة</h2><p className="muted">قبول الإثبات يسجّل كل الشهور المرتبطة به كمدفوعة.</p></div></div>
        {submissions.filter((s) => s.status === "pending").length === 0 ? <p className="empty-inline">لا توجد إثباتات معلّقة حاليًا.</p> : <div className="review-list">{submissions.filter((s) => s.status === "pending").map((submission) => {
          const member = members.find((m) => m.id === submission.memberId);
          const related = payments.filter((p) => p.submissionId === submission.id);
          return <article className="review-row" key={submission.id}><div className="review-icon"><WalletCards /></div><div><strong>{member?.name}</strong><span>{formatMoney(submission.amount)} · {related.map((p) => cycleLabel(association.startDate, p.cycleNumber)).join("، ")}</span><small>{formatDate(submission.submittedAt)}</small></div><div className="review-actions"><Link href={`/admin/proofs/${submission.id}`} target="_blank" className="button ghost">عرض الصورة</Link><form action={reviewSubmission}><input type="hidden" name="submissionId" value={submission.id} /><button name="decision" value="paid" className="button success">قبول</button><button name="decision" value="rejected" className="button danger">رفض</button></form></div></article>;
        })}</div>}
      </section>

      <section className="section-card association-settings" id="association-settings">
        <div className="settings-row"><div><strong>بيانات الجمعية</strong><small>الاسم، القيمة، الحالة، البداية وعدد الأدوار</small></div><EditModal title="تعديل بيانات الجمعية" description="الدفعات المقبولة تظل محفوظة كما هي." triggerLabel="تعديل الجمعية" action={updateAssociation} wide><input type="hidden" name="associationId" value={association.id} /><div className="form-grid"><label>اسم الجمعية<input name="name" defaultValue={association.name} required /></label><label>حالة الجمعية<select name="status" defaultValue={association.status}><option value="active">نشطة — استقبال دفعات</option><option value="paused">متوقفة مؤقتًا</option><option value="completed">مكتملة</option></select></label><label>قيمة السهم<input name="installmentAmount" type="number" min="1" defaultValue={association.installmentAmount} required /></label><label>تاريخ البداية<input name="startDate" type="date" defaultValue={association.startDate.toISOString().slice(0, 10)} required /></label><label>يوم الدفع<input name="paymentDay" type="number" min="1" max="28" defaultValue={association.paymentDay} required /></label></div><label>عدد الأدوار <small>(اختياري)</small><input name="plannedSlots" type="number" min="1" defaultValue={association.plannedSlots ?? ""} placeholder="يتحدد تلقائيًا لو فارغ" /></label></EditModal></div>
      </section>

      <section className="section-card danger-card"><div><strong>حذف الجمعية نهائيًا</strong><small>سيتم حذف كل الأفراد والأسهم والدفعات والإثباتات التابعة لها.</small></div><EditModal title={`حذف ${association.name}`} description="هذا الإجراء نهائي ولا يمكن التراجع عنه." triggerLabel="حذف الجمعية" submitLabel="حذف نهائي" action={deleteAssociation} kind="danger"><input type="hidden" name="associationId" value={association.id} /><label>اكتب اسم الجمعية للتأكيد<input name="confirmation" placeholder={association.name} autoComplete="off" required /></label></EditModal></section>
    </main>
  );
}
