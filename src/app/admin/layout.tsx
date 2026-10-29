import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, LogOut, Settings, UsersRound } from "lucide-react";
import { logout } from "@/actions/auth";
import { getAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/admin" className="sidebar-brand"><span>ج</span><strong>جمعيتي</strong></Link>
        <nav>
          <Link href="/admin"><LayoutDashboard size={19} /> نظرة عامة</Link>
          <Link href="/admin"><UsersRound size={19} /> الجمعيات</Link>
          <Link href="/admin/settings"><Settings size={19} /> الإعدادات</Link>
        </nav>
        <form action={logout}><button className="sidebar-logout"><LogOut size={18} /> تسجيل الخروج</button></form>
      </aside>
      <div className="admin-main">
        <header className="mobile-header"><Link href="/admin" className="sidebar-brand"><span>ج</span><strong>جمعيتي</strong></Link><span className="muted">{admin.username}</span></header>
        {children}
      </div>
    </div>
  );
}
