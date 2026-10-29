import Link from "next/link";
import { ArrowRight, CalendarDays, CircleDollarSign } from "lucide-react";
import { createAssociation } from "@/actions/associations";

export default function NewAssociationPage() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main className="page-wrap narrow">
      <Link href="/admin" className="back-link"><ArrowRight size={18} /> الرجوع</Link>
      <div className="page-heading"><div><span className="eyebrow">جمعية جديدة</span><h1>ابدأ تنظيم الجمعية</h1><p className="muted">حدد الأساسيات، ثم أضف الأفراد وأدوارهم.</p></div></div>
      <form action={createAssociation} className="form-card">
        <label>اسم الجمعية<input name="name" placeholder="مثال: جمعية الأصدقاء 2026" required minLength={2} /></label>
        <div className="form-grid">
          <label>قيمة السهم شهريًا<div className="input-with-icon"><CircleDollarSign size={19} /><input name="installmentAmount" type="number" min="1" step="1" placeholder="5000" required /></div></label>
          <label>تاريخ بداية الجمعية<div className="input-with-icon"><CalendarDays size={19} /><input name="startDate" type="date" defaultValue={today} required /></div></label>
        </div>
        <label>يوم الدفع من كل شهر<input name="paymentDay" type="number" min="1" max="28" defaultValue="1" required /><small>اختر من 1 إلى 28 حتى يظل الموعد صالحًا في كل الشهور.</small></label>
        <button className="button primary" type="submit">إنشاء الجمعية والمتابعة</button>
      </form>
    </main>
  );
}
