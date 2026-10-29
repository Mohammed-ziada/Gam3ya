"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Settings } from "lucide-react";

const items = [
  { href: "/admin", label: "الرئيسية", icon: Home, exact: true },
  { href: "/admin/associations/new", label: "جمعية جديدة", icon: PlusCircle },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  return <nav className="mobile-nav" aria-label="التنقل الرئيسي">{items.map((item) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon size={20} /><span>{item.label}</span></Link>;
  })}</nav>;
}
