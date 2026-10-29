import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { admins } from "@/lib/schema";

export default async function Home() {
  const [{ value }] = await db.select({ value: count() }).from(admins);
  redirect(value === 0 ? "/setup" : "/admin");
}
