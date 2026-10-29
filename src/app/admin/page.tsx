import Link from "next/link";
import { count, desc, eq, sum } from "drizzle-orm";
import { ArrowLeft, CircleDollarSign, Clock3, Plus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { associations, members, monthlyPayments, paymentSubmissions, shares } from "@/lib/schema";

export default async function DashboardPage() {
  const [associationRows, memberCounts, shareCounts, [pending], [paid]] = await Promise.all([
    db.select().from(associations).orderBy(desc(associations.createdAt)),
    db.select({ associationId: members.associationId, value: count() }).from(members).groupBy(members.associationId),
    db.select({ associationId: members.associationId, value: sum(shares.sharePercent) }).from(shares).innerJoin(members, eq(shares.memberId, members.id)).groupBy(members.associationId),
    db.select({ value: count() }).from(paymentSubmissions).where(eq(paymentSubmissions.status, "pending")),
    db.select({ value: sum(monthlyPayments.amount) }).from(monthlyPayments).where(eq(monthlyPayments.status, "paid")),
  ]);
  const totalPaid = Number(paid?.value ?? 0);

  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div><span className="eyebrow">لوحة المنظّم</span><h1>كل جمعياتك في مكان واحد</h1><p className="muted">تابع التحصيل، راجع الإثباتات، واعرف الدور الحالي.</p></div>
        <Link href="/admin/associations/new" className="button primary"><Plus size={18} /> جمعية جديدة</Link>
      </div>
      <section className="stats-grid">
        <article className="stat-card amber"><div className="stat-icon"><Users /></div><div><span>الجمعيات النشطة</span><strong>{associationRows.filter((a) => a.status === "active").length}</strong></div></article>
        <article className="stat-card blue"><div className="stat-icon"><CircleDollarSign /></div><div><span>إجمالي المحصّل</span><strong>{formatMoney(totalPaid)}</strong></div></article>
        <article className="stat-card coral"><div className="stat-icon"><Clock3 /></div><div><span>بانتظار المراجعة</span><strong>{pending?.value ?? 0}</strong></div></article>
      </section>
      <section className="section-card">
        <div className="section-title"><div><h2>الجمعيات</h2><p className="muted">اضغط على أي جمعية لمتابعة تفاصيلها.</p></div></div>
        {associationRows.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Users /></div><h3>لسه مفيش جمعيات</h3><p>أنشئ أول جمعية، وبعدها أضف الأفراد وأدوار القبض.</p><Link href="/admin/associations/new" className="button primary">إنشاء أول جمعية</Link></div>
        ) : (
          <div className="association-list">
            {associationRows.map((association) => {
              const memberCount = memberCounts.find((row) => row.associationId === association.id)?.value ?? 0;
              const shareCount = Number(shareCounts.find((row) => row.associationId === association.id)?.value ?? 0) / 100;
              return <Link key={association.id} href={`/admin/associations/${association.id}`} className="association-row"><div><span className={`status-dot ${association.status}`} /><strong>{association.name}</strong><small>{memberCount} أفراد · {shareCount} أسهم · {association.status === "active" ? "نشطة" : association.status === "paused" ? "متوقفة" : "مكتملة"}</small></div><div><b>{formatMoney(association.installmentAmount)}</b><ArrowLeft size={19} /></div></Link>;
            })}
          </div>
        )}
      </section>
    </main>
  );
}
