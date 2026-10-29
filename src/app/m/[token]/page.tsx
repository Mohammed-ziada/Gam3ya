import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CalendarCheck, CircleDollarSign, Clock3, Layers3 } from "lucide-react";
import { PaymentUpload } from "@/components/payment-upload";
import { db } from "@/lib/db";
import { cycleLabel, formatMoney } from "@/lib/format";
import { associations, members, monthlyPayments, shares } from "@/lib/schema";

const statusText = { unpaid: "مطلوب", pending: "قيد المراجعة", paid: "تم الدفع", rejected: "مرفوض - أعد الرفع" } as const;

export default async function MemberPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [member] = await db.select().from(members).where(and(eq(members.publicToken, token), eq(members.active, true))).limit(1);
  if (!member) notFound();
  const [association] = await db.select().from(associations).where(eq(associations.id, member.associationId)).limit(1);
  if (!association) notFound();
  const ownShares = await db.select().from(shares).where(eq(shares.memberId, member.id)).orderBy(asc(shares.payoutOrder));
  const payments = await db.select().from(monthlyPayments).where(eq(monthlyPayments.memberId, member.id)).orderBy(asc(monthlyPayments.cycleNumber));
  const paidCount = payments.filter((payment) => payment.status === "paid").length;
  const pendingCount = payments.filter((payment) => payment.status === "pending").length;
  const remainingAmount = payments.filter((payment) => payment.status !== "paid").reduce((sum, payment) => sum + payment.amount, 0);
  const today = new Date();
  const options = payments.filter((payment) => payment.status === "unpaid" || payment.status === "rejected").map((payment) => ({
    id: payment.id,
    label: cycleLabel(association.startDate, payment.cycleNumber),
    amount: payment.amount,
    overdue: payment.dueDate < today,
  }));

  return <main className="member-page">
    <header className="member-hero"><div className="public-brand"><span>ج</span> جمعيتي</div><div className="member-greeting"><span>أهلًا،</span><h1>{member.name}</h1><p>{association.name}</p></div><div className="hero-orb orb-one" /><div className="hero-orb orb-two" /></header>
    <div className="member-content">
      <section className="member-stats">
        <article><div className="stat-icon"><CircleDollarSign /></div><span>قيمة دفعتك الشهرية</span><strong>{formatMoney(association.installmentAmount * ownShares.length)}</strong></article>
        <article><div className="stat-icon"><Clock3 /></div><span>إجمالي المتبقي</span><strong>{formatMoney(remainingAmount)}</strong></article>
        <article><div className="stat-icon"><Layers3 /></div><span>الدفعات</span><strong>{paidCount} من {payments.length}</strong><small>{pendingCount ? `${pendingCount} قيد المراجعة` : ""}</small></article>
      </section>

      <section className="payout-section"><div className="public-section-title"><div><CalendarCheck /><span><b>مواعيد قبضك</b><small>كل سهم له دور مستقل</small></span></div></div><div className="payout-cards">{ownShares.map((share) => <article key={share.id}><span>{share.label}</span><strong>{cycleLabel(association.startDate, share.payoutOrder)}</strong><small>قيمة القبضة {formatMoney(association.installmentAmount * payments.length)}</small></article>)}</div></section>

      <PaymentUpload token={token} options={options} />

      <section className="history-card"><div className="public-section-title"><div><Clock3 /><span><b>سجل الدفعات</b><small>آخر حالة لكل شهر</small></span></div></div><div className="history-list">{payments.map((payment) => <div key={payment.id}><span><b>{cycleLabel(association.startDate, payment.cycleNumber)}</b><small>{formatMoney(payment.amount)}</small></span><em className={`payment-status ${payment.status}`}>{statusText[payment.status]}</em></div>)}</div></section>
      <footer className="public-footer">هذا الرابط خاص بك، لا تشاركه مع أي شخص.</footer>
    </div>
  </main>;
}
