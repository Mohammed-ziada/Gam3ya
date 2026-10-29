import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";
import { getAdmin } from "@/lib/auth";

export default async function SettingsPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return <main className="page-wrap narrow"><div className="page-heading"><div><span className="eyebrow">الإعدادات</span><h1>بيانات دخول المنظّم</h1><p className="muted">غيّر اسم المستخدم أو كلمة المرور في أي وقت.</p></div></div><SettingsForm username={admin.username} /></main>;
}
