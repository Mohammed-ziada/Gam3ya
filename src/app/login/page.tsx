import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { admins } from "@/lib/schema";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  const [{ value }] = await db.select({ value: count() }).from(admins);
  if (value === 0) redirect("/setup");
  return <main className="auth-shell"><AuthForm mode="login" /></main>;
}
