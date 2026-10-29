import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ExternalLink, Plus, WalletCards } from "lucide-react";
import { addMember, associationDetails, reviewSubmission } from "@/actions/associations";
import { CopyLink } from "@/components/copy-link";
import { cycleLabel, formatDate, formatMoney } from "@/lib/format";

export default async function AssociationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await associationDetails(id);
  if (!data) notFound();
  const { association, members, shares, payments, submissions } = data;
  const pot = association.installmentAmount * shares.length;

  return (
    <main className="page-wrap">
      <Link href="/admin" className="back-link"><ArrowRight size={18} /> كل الجمعيات</Link>
      <div className="page-heading"><div><span className="eyebrow">جمعية نشطة</span><h1>{association.name}</h1><p className="muted">بدأت {formatDate(association.startDate)} · الدفع يوم {association.paymentDay} من كل شهر</p></div><div className="pot-card"><span>قيمة القبضة</span><strong>{formatMoney(pot)}</strong></div></div>
      <section className="stats-grid compact">
        <article className="mini-stat"><span>الأفراد</span><strong>{members.length}</strong></article>
        <article className="mini-stat"><span>إجمالي الأسهم</span><strong>{shares.length}</strong></article>
        <article className="mini-stat"><span>دفعات معلّقة</span><strong>{submissions.filter((s) => s.status === "pending").length}</strong></article>
        <article className="mini-stat"><span>مدة الجمعية</span><strong>{shares.length} شهر</strong></article>
      </section>

      <div className="content-grid">
        <section className="section-card span-2">
          <div className="section-title"><div><h2>الأفراد والأسهم</h2><p className="muted">كل فرد له رابط واحد حتى لو كان داخل بأكثر من سهم.</p></div></div>
          {members.length === 0 ? <p className="empty-inline">أضف أول فرد من النموذج المجاور.</p> : <div className="member-table">
            {members.map((member) => {
              const ownShares = shares.filter((share) => share.memberId === member.id);
              const ownPayments = payments.filter((payment) => payment.memberId === member.id);
              const paid = ownPayments.filter((payment) => payment.status === "paid").length;
              return <article className="member-row" key={member.id}><div className="avatar">{member.name.charAt(0)}</div><div className="member-info"><strong>{member.name}</strong><small>{ownShares.length} {ownShares.length === 1 ? "سهم" : "أسهم"} · دفع {paid} من {shares.length}</small><div className="chips">{ownShares.map((share) => <span key={share.id}>{share.label}: {cycleLabel(association.startDate, share.payoutOrder)}</span>)}</div></div><div className="member-actions"><CopyLink token={member.publicToken} /><Link className="icon-button" href={`/m/${member.publicToken}`} target="_blank"><ExternalLink size={17} /> فتح</Link></div></article>;
            })}
          </div>}
        </section>

        <section className="section-card add-member-card">
          <div className="section-title"><div><h2><Plus size={20} /> إضافة فرد</h2><p className="muted">اكتب كل أدوار القبض لنفس الشخص.</p></div></div>
          <form action={addMember} className="stack-form">
            <input type="hidden" name="associationId" value={association.id} />
            <label>اسم الفرد<input name="name" placeholder="الاسم" required /></label>
            <label>رقم الهاتف <small>(اختياري)</small><input name="phone" inputMode="tel" placeholder="01xxxxxxxxx" /></label>
            <label>ترتيب القبض<input name="payoutOrders" placeholder="مثال: 1، 8" required /><small>لو له سهمان اكتب الدورين مفصولين بفاصلة.</small></label>
            <button className="button primary full"><Plus size={17} /> إضافة الفرد</button>
          </form>
        </section>
      </div>

      <section className="section-card">
        <div className="section-title"><div><h2>إثباتات بانتظار المراجعة</h2><p className="muted">قبول الإثبات يسجّل كل الشهور المرتبطة به كمدفوعة.</p></div></div>
        {submissions.filter((s) => s.status === "pending").length === 0 ? <p className="empty-inline">لا توجد إثباتات معلّقة حاليًا.</p> : <div className="review-list">{submissions.filter((s) => s.status === "pending").map((submission) => {
          const member = members.find((m) => m.id === submission.memberId);
          const related = payments.filter((p) => p.submissionId === submission.id);
          return <article className="review-row" key={submission.id}><div className="review-icon"><WalletCards /></div><div><strong>{member?.name}</strong><span>{formatMoney(submission.amount)} · {related.map((p) => cycleLabel(association.startDate, p.cycleNumber)).join("، ")}</span><small>{formatDate(submission.submittedAt)}</small></div><div className="review-actions"><Link href={`/admin/proofs/${submission.id}`} target="_blank" className="button ghost">عرض الصورة</Link><form action={reviewSubmission}><input type="hidden" name="submissionId" value={submission.id} /><button name="decision" value="paid" className="button success">قبول</button><button name="decision" value="rejected" className="button danger">رفض</button></form></div></article>;
        })}</div>}
      </section>
    </main>
  );
}
