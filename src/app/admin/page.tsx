import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, CircleDollarSign, Clock3, Plus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { associations, members, monthlyPayments, paymentSubmissions, shares } from "@/lib/schema";

export default async function DashboardPage() {
  const associationRows = await db.select().from(associations).orderBy(desc(associations.createdAt));
  const memberRows = await db.select().from(members);
  const shareRows = await db.select().from(shares);
  const pending = await db.select().from(paymentSubmissions).where(eq(paymentSubmissions.status, "pending"));
  const paidRows = await db.select().from(monthlyPayments).where(eq(monthlyPayments.status, "paid"));
  const totalPaid = paidRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div><span className="eyebrow">لوحة المنظّم</span><h1>كل جمعياتك في مكان واحد</h1><p className="muted">تابع التحصيل، راجع الإثباتات، واعرف الدور الحالي.</p></div>
        <Link href="/admin/associations/new" className="button primary"><Plus size={18} /> جمعية جديدة</Link>
      </div>
      <section className="stats-grid">
        <article className="stat-card amber"><div className="stat-icon"><Users /></div><div><span>الجمعيات النشطة</span><strong>{associationRows.filter((a) => a.status === "active").length}</strong></div></article>
        <article className="stat-card blue"><div className="stat-icon"><CircleDollarSign /></div><div><span>إجمالي المحصّل</span><strong>{formatMoney(totalPaid)}</strong></div></article>
        <article className="stat-card coral"><div className="stat-icon"><Clock3 /></div><div><span>بانتظار المراجعة</span><strong>{pending.length}</strong></div></article>
      </section>
      <section className="section-card">
        <div className="section-title"><div><h2>الجمعيات</h2><p className="muted">اضغط على أي جمعية لمتابعة تفاصيلها.</p></div></div>
        {associationRows.length === 0 ? (
          <div className="empty-state"><div className="empty-icon"><Users /></div><h3>لسه مفيش جمعيات</h3><p>أنشئ أول جمعية، وبعدها أضف الأفراد وأدوار القبض.</p><Link href="/admin/associations/new" className="button primary">إنشاء أول جمعية</Link></div>
        ) : (
          <div className="association-list">
            {associationRows.map((association) => {
              const associationMembers = memberRows.filter((m) => m.associationId === association.id);
              const ids = associationMembers.map((m) => m.id);
              const shareCount = shareRows.filter((s) => ids.includes(s.memberId)).length;
              return <Link key={association.id} href={`/admin/associations/${association.id}`} className="association-row"><div><span className="status-dot" /><strong>{association.name}</strong><small>{associationMembers.length} أفراد · {shareCount} أسهم</small></div><div><b>{formatMoney(association.installmentAmount)}</b><ArrowLeft size={19} /></div></Link>;
            })}
          </div>
        )}
      </section>
    </main>
  );
}
