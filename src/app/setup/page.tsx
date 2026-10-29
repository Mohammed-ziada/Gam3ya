import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { db } from "@/lib/db";
import { admins } from "@/lib/schema";

export default async function SetupPage() {
  const [{ value }] = await db.select({ value: count() }).from(admins);
  if (value > 0) redirect("/login");
  return <main className="auth-shell"><AuthForm mode="setup" /></main>;
}
