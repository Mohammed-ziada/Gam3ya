"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cycleDate, randomToken } from "@/lib/format";
import {
  associations,
  members,
  monthlyPayments,
  paymentSubmissions,
  shares,
} from "@/lib/schema";

async function requireAdmin() {
  if (!(await getAdmin())) throw new Error("غير مصرح");
}

export async function createAssociation(formData: FormData) {
  await requireAdmin();
  const parsed = z.object({
    name: z.string().trim().min(2),
    installmentAmount: z.coerce.number().int().positive(),
    startDate: z.coerce.date(),
    paymentDay: z.coerce.number().int().min(1).max(28),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("راجع بيانات الجمعية");

  const [association] = await db.insert(associations).values(parsed.data).returning({ id: associations.id });
  redirect(`/admin/associations/${association.id}`);
}

async function syncPaymentSchedule(associationId: string) {
  const [association] = await db.select().from(associations).where(eq(associations.id, associationId)).limit(1);
  if (!association) return;
  const memberRows = await db.select().from(members).where(eq(members.associationId, associationId));
  const memberIds = memberRows.map((member) => member.id);
  if (!memberIds.length) return;
  const shareRows = await db.select().from(shares).where(inArray(shares.memberId, memberIds));
  const totalCycles = shareRows.length;

  for (const member of memberRows) {
    const shareCount = shareRows.filter((share) => share.memberId === member.id).length;
    const amount = shareCount * association.installmentAmount;
    for (let cycle = 1; cycle <= totalCycles; cycle += 1) {
      await db.insert(monthlyPayments).values({
        memberId: member.id,
        cycleNumber: cycle,
        dueDate: cycleDate(association.startDate, cycle, association.paymentDay),
        amount,
      }).onConflictDoNothing();
    }
    await db.update(monthlyPayments).set({ amount, updatedAt: new Date() }).where(eq(monthlyPayments.memberId, member.id));
  }
}

export async function addMember(formData: FormData) {
  await requireAdmin();
  const associationId = String(formData.get("associationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const rawOrders = String(formData.get("payoutOrders") ?? "");
  const payoutOrders = rawOrders.split(/[،,\s]+/).filter(Boolean).map(Number);
  if (!associationId || name.length < 2 || !payoutOrders.length || payoutOrders.some((n) => !Number.isInteger(n) || n < 1)) {
    throw new Error("راجع اسم الفرد وترتيب القبض");
  }
  if (new Set(payoutOrders).size !== payoutOrders.length) throw new Error("ترتيب القبض مكرر");

  const existingMembers = await db.select({ id: members.id }).from(members).where(eq(members.associationId, associationId));
  if (existingMembers.length) {
    const used = await db.select({ order: shares.payoutOrder }).from(shares).where(inArray(shares.memberId, existingMembers.map((m) => m.id)));
    if (payoutOrders.some((order) => used.some((row) => row.order === order))) throw new Error("أحد أدوار القبض مستخدم بالفعل");
  }

  const [member] = await db.insert(members).values({ associationId, name, phone, publicToken: randomToken() }).returning({ id: members.id });
  await db.insert(shares).values(payoutOrders.map((payoutOrder, index) => ({
    memberId: member.id,
    payoutOrder,
    label: payoutOrders.length === 1 ? name : `${name} - السهم ${index + 1}`,
  })));
  await syncPaymentSchedule(associationId);
  revalidatePath(`/admin/associations/${associationId}`);
}

export async function reviewSubmission(formData: FormData) {
  await requireAdmin();
  const submissionId = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!submissionId || !["paid", "rejected"].includes(decision)) throw new Error("قرار غير صالح");

  const status = decision as "paid" | "rejected";
  await db.update(paymentSubmissions).set({ status, rejectionReason: reason, reviewedAt: new Date() }).where(eq(paymentSubmissions.id, submissionId));
  await db.update(monthlyPayments).set({
    status: status === "paid" ? "paid" : "rejected",
    submissionId: status === "paid" ? submissionId : null,
    updatedAt: new Date(),
  }).where(eq(monthlyPayments.submissionId, submissionId));
  revalidatePath("/admin");
}

export async function recordCashPayment(formData: FormData) {
  await requireAdmin();
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return;
  await db.update(monthlyPayments).set({ status: "paid", updatedAt: new Date() }).where(eq(monthlyPayments.id, paymentId));
  revalidatePath("/admin");
}

export async function associationDetails(id: string) {
  const [association] = await db.select().from(associations).where(eq(associations.id, id)).limit(1);
  if (!association) return null;
  const memberRows = await db.select().from(members).where(eq(members.associationId, id)).orderBy(asc(members.createdAt));
  const ids = memberRows.map((member) => member.id);
  const shareRows = ids.length ? await db.select().from(shares).where(inArray(shares.memberId, ids)).orderBy(asc(shares.payoutOrder)) : [];
  const paymentRows = ids.length ? await db.select().from(monthlyPayments).where(inArray(monthlyPayments.memberId, ids)) : [];
  const submissions = ids.length ? await db.select().from(paymentSubmissions).where(inArray(paymentSubmissions.memberId, ids)).orderBy(sql`${paymentSubmissions.submittedAt} desc`) : [];
  return { association, members: memberRows, shares: shareRows, payments: paymentRows, submissions };
}
