"use server";

import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/format";
import { admins, sessions } from "@/lib/schema";

export type AuthState = { error?: string; recoveryCode?: string };

const credentialsSchema = z.object({
  username: z.string().trim().min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل").max(40),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(128),
});

export async function setupAdmin(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const [{ value }] = await db.select({ value: count() }).from(admins);
  if (value > 0) return { error: "تم إعداد حساب المنظّم بالفعل" };

  const recoveryCode = randomToken(18);
  const [admin] = await db.insert(admins).values({
    username: parsed.data.username,
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    recoveryHash: await bcrypt.hash(recoveryCode, 12),
  }).returning({ id: admins.id });
  await createSession(admin.id);
  return { recoveryCode };
}

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "راجع اسم المستخدم وكلمة المرور" };

  const [admin] = await db.select().from(admins).where(eq(admins.username, parsed.data.username)).limit(1);
  if (!admin || !(await bcrypt.compare(parsed.data.password, admin.passwordHash))) {
    return { error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }
  await createSession(admin.id);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function updateCredentials(_state: AuthState, formData: FormData): Promise<AuthState> {
  const admin = await getAdmin();
  if (!admin) return { error: "انتهت الجلسة، سجّل الدخول مجددًا" };
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");

  const [record] = await db.select().from(admins).where(eq(admins.id, admin.id)).limit(1);
  if (!record || !(await bcrypt.compare(currentPassword, record.passwordHash))) {
    return { error: "كلمة المرور الحالية غير صحيحة" };
  }
  if (username.length < 3) return { error: "اسم المستخدم قصير جدًا" };
  if (newPassword && newPassword.length < 8) return { error: "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل" };

  await db.update(admins).set({
    username,
    passwordHash: newPassword ? await bcrypt.hash(newPassword, 12) : record.passwordHash,
    updatedAt: new Date(),
  }).where(eq(admins.id, admin.id));
  if (newPassword) await db.delete(sessions).where(eq(sessions.adminId, admin.id));
  return { error: newPassword ? "تم الحفظ. سجّل الدخول بكلمة المرور الجديدة." : "تم حفظ اسم المستخدم." };
}
