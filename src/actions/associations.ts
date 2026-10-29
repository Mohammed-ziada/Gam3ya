"use server";

import { and, asc, eq, gt, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cycleDate, randomToken } from "@/lib/format";
import { deletePrivateFiles } from "@/lib/storage";
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
    plannedSlots: z.preprocess((value) => value === "" ? null : value, z.coerce.number().int().positive().nullable()),
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
  const highestOrder = shareRows.reduce((max, share) => Math.max(max, share.payoutOrder), 0);
  const totalCycles = association.plannedSlots ?? highestOrder;
  if (totalCycles < 1) return;

  for (const member of memberRows) {
    const sharePercentage = shareRows
      .filter((share) => share.memberId === member.id)
      .reduce((sum, share) => sum + share.sharePercent, 0);
    const amount = Math.round(association.installmentAmount * sharePercentage / 100);
    for (let cycle = 1; cycle <= totalCycles; cycle += 1) {
      await db.insert(monthlyPayments).values({
        memberId: member.id,
        cycleNumber: cycle,
        dueDate: cycleDate(association.startDate, cycle, association.paymentDay),
        amount,
      }).onConflictDoNothing({
        target: [monthlyPayments.memberId, monthlyPayments.cycleNumber],
      });
      await db.update(monthlyPayments).set({
        dueDate: cycleDate(association.startDate, cycle, association.paymentDay),
        amount,
        updatedAt: new Date(),
      }).where(and(
        eq(monthlyPayments.memberId, member.id),
        eq(monthlyPayments.cycleNumber, cycle),
        inArray(monthlyPayments.status, ["unpaid", "rejected"]),
      ));
    }
    await db.delete(monthlyPayments).where(and(
      eq(monthlyPayments.memberId, member.id),
      gt(monthlyPayments.cycleNumber, totalCycles),
      notInArray(monthlyPayments.status, ["paid", "pending"]),
    ));
  }
}

async function validateShareAllocation(
  associationId: string,
  payoutOrders: number[],
  sharePercent: number,
  excludedMemberId?: string,
) {
  const [association] = await db.select().from(associations).where(eq(associations.id, associationId)).limit(1);
  if (!association) throw new Error("الجمعية غير موجودة");
  if (association.plannedSlots && payoutOrders.some((order) => order > association.plannedSlots!)) {
    throw new Error(`أقصى دور في هذه الجمعية هو ${association.plannedSlots}`);
  }
  const associationMembers = await db.select({ id: members.id }).from(members).where(eq(members.associationId, associationId));
  const includedIds = associationMembers.map((member) => member.id).filter((id) => id !== excludedMemberId);
  const existing = includedIds.length
    ? await db.select().from(shares).where(inArray(shares.memberId, includedIds))
    : [];
  for (const order of payoutOrders) {
    const occupied = existing.filter((share) => share.payoutOrder === order).reduce((sum, share) => sum + share.sharePercent, 0);
    if (occupied + sharePercent > 100) throw new Error(`الدور ${order} مكتمل بالفعل`);
  }
}

export async function addMember(formData: FormData) {
  await requireAdmin();
  const associationId = String(formData.get("associationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const secondaryName = String(formData.get("secondaryName") ?? "").trim() || null;
  const sharePercent = Number(formData.get("sharePercent") ?? 100);
  const rawOrders = String(formData.get("payoutOrders") ?? "");
  const payoutOrders = rawOrders.split(/[،,\s]+/).filter(Boolean).map(Number);
  if (!associationId || name.length < 2 || ![50, 100].includes(sharePercent) || !payoutOrders.length || payoutOrders.some((n) => !Number.isInteger(n) || n < 1)) {
    throw new Error("راجع اسم الفرد وترتيب القبض");
  }
  if (new Set(payoutOrders).size !== payoutOrders.length) throw new Error("ترتيب القبض مكرر");

  await validateShareAllocation(associationId, payoutOrders, sharePercent);

  const [member] = await db.insert(members).values({ associationId, name, secondaryName, phone, publicToken: randomToken() }).returning({ id: members.id });
  await db.insert(shares).values(payoutOrders.map((payoutOrder, index) => ({
    memberId: member.id,
    payoutOrder,
    sharePercent,
    label: payoutOrders.length === 1 ? name : `${name} - السهم ${index + 1}`,
  })));
  await syncPaymentSchedule(associationId);
  revalidatePath(`/admin/associations/${associationId}`);
}

export async function updateAssociation(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("associationId") ?? "");
  const parsed = z.object({
    name: z.string().trim().min(2),
    installmentAmount: z.coerce.number().int().positive(),
    startDate: z.coerce.date(),
    paymentDay: z.coerce.number().int().min(1).max(28),
    plannedSlots: z.preprocess((value) => value === "" ? null : value, z.coerce.number().int().positive().nullable()),
    status: z.enum(["active", "paused", "completed"]),
  }).safeParse(Object.fromEntries(formData));
  if (!id || !parsed.success) throw new Error("راجع بيانات الجمعية");

  if (parsed.data.plannedSlots) {
    const memberRows = await db.select({ id: members.id }).from(members).where(eq(members.associationId, id));
    if (memberRows.length) {
      const shareRows = await db.select().from(shares).where(inArray(shares.memberId, memberRows.map((member) => member.id)));
      if (shareRows.some((share) => share.payoutOrder > parsed.data.plannedSlots!)) {
        throw new Error("لا يمكن تقليل العدد قبل تعديل الأدوار الأكبر منه");
      }
    }
  }
  await db.update(associations).set({ ...parsed.data, updatedAt: new Date() }).where(eq(associations.id, id));
  await syncPaymentSchedule(id);
  revalidatePath("/admin");
  revalidatePath(`/admin/associations/${id}`);
}

export async function updateMember(formData: FormData) {
  await requireAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  const associationId = String(formData.get("associationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const secondaryName = String(formData.get("secondaryName") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const sharePercent = Number(formData.get("sharePercent") ?? 100);
  const payoutOrders = String(formData.get("payoutOrders") ?? "").split(/[،,\s]+/).filter(Boolean).map(Number);
  if (!memberId || !associationId || name.length < 2 || ![50, 100].includes(sharePercent) || !payoutOrders.length || payoutOrders.some((order) => !Number.isInteger(order) || order < 1)) {
    throw new Error("راجع بيانات الفرد والأدوار");
  }
  if (new Set(payoutOrders).size !== payoutOrders.length) throw new Error("ترتيب القبض مكرر");
  await validateShareAllocation(associationId, payoutOrders, sharePercent, memberId);

  await db.update(members).set({ name, secondaryName, phone, updatedAt: new Date() }).where(eq(members.id, memberId));
  await db.delete(shares).where(eq(shares.memberId, memberId));
  await db.insert(shares).values(payoutOrders.map((payoutOrder, index) => ({
    memberId,
    payoutOrder,
    sharePercent,
    label: payoutOrders.length === 1 ? name : `${name} - السهم ${index + 1}`,
  })));
  await syncPaymentSchedule(associationId);
  revalidatePath("/admin");
  revalidatePath(`/admin/associations/${associationId}`);
}

export type MemberManagementState = { saved: number; message: string | null; error: string | null };

export async function manageMember(previous: MemberManagementState, formData: FormData): Promise<MemberManagementState> {
  await requireAdmin();
  const associationId = String(formData.get("associationId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const operation = String(formData.get("operation") ?? "");
  const [member] = await db.select().from(members).where(and(
    eq(members.id, memberId),
    eq(members.associationId, associationId),
  )).limit(1);
  if (!member) return { ...previous, error: "الفرد غير موجود", message: null };

  try {
    if (operation === "regenerate-link") {
      const newToken = randomToken();
      await db.update(members).set({ publicToken: newToken, active: true, updatedAt: new Date() }).where(eq(members.id, member.id));
      revalidatePath(`/m/${member.publicToken}`);
      revalidatePath(`/m/${newToken}`);
      revalidatePath(`/admin/associations/${associationId}`);
      return { saved: previous.saved + 1, message: "تم إنشاء رابط جديد وتفعيل الفرد. الرابط القديم لم يعد صالحًا.", error: null };
    }

    if (operation === "toggle-active") {
      const active = !member.active;
      await db.update(members).set({ active, updatedAt: new Date() }).where(eq(members.id, member.id));
      revalidatePath(`/m/${member.publicToken}`);
      revalidatePath(`/admin/associations/${associationId}`);
      return { saved: previous.saved + 1, message: active ? "تم تفعيل رابط الفرد." : "تم إيقاف رابط الفرد مؤقتًا.", error: null };
    }

    if (operation === "delete") {
      const confirmation = String(formData.get("confirmation") ?? "").trim();
      if (confirmation !== member.name) return { ...previous, error: "اكتب اسم الفرد كما هو لتأكيد الحذف", message: null };
      const [proofs, payoutProofs] = await Promise.all([
        db.select({ key: paymentSubmissions.proofKey }).from(paymentSubmissions).where(eq(paymentSubmissions.memberId, member.id)),
        db.select({ key: shares.payoutProofKey }).from(shares).where(eq(shares.memberId, member.id)),
      ]);
      await deletePrivateFiles([...proofs.map((row) => row.key), ...payoutProofs.map((row) => row.key)]);
      await db.delete(members).where(eq(members.id, member.id));
      await syncPaymentSchedule(associationId);
      revalidatePath("/admin");
      revalidatePath(`/admin/associations/${associationId}`);
      revalidatePath(`/m/${member.publicToken}`);
      return { saved: previous.saved + 1, message: "تم حذف الفرد وكل بياناته.", error: null };
    }
    return { ...previous, error: "الإجراء غير صالح", message: null };
  } catch {
    return { ...previous, error: "تعذر تنفيذ الإجراء، حاول مرة أخرى", message: null };
  }
}

export async function deleteAssociation(formData: FormData) {
  await requireAdmin();
  const associationId = String(formData.get("associationId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const [association] = await db.select().from(associations).where(eq(associations.id, associationId)).limit(1);
  if (!association) throw new Error("الجمعية غير موجودة");
  if (confirmation !== association.name) throw new Error("اكتب اسم الجمعية كما هو لتأكيد الحذف");

  const memberRows = await db.select({ id: members.id }).from(members).where(eq(members.associationId, associationId));
  const memberIds = memberRows.map((member) => member.id);
  if (memberIds.length) {
    const [proofs, payoutProofs] = await Promise.all([
      db.select({ key: paymentSubmissions.proofKey }).from(paymentSubmissions).where(inArray(paymentSubmissions.memberId, memberIds)),
      db.select({ key: shares.payoutProofKey }).from(shares).where(inArray(shares.memberId, memberIds)),
    ]);
    await deletePrivateFiles([...proofs.map((row) => row.key), ...payoutProofs.map((row) => row.key)]);
  }
  await db.delete(associations).where(eq(associations.id, associationId));
  revalidatePath("/admin");
  redirect("/admin");
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

export async function recordManualPayments(formData: FormData) {
  await requireAdmin();
  const associationId = String(formData.get("associationId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const paymentIds = [...new Set(formData.getAll("paymentIds").map(String).filter(Boolean))];
  if (!associationId || !memberId || !paymentIds.length) throw new Error("اختار شهر واحد على الأقل");

  const [member] = await db.select({ publicToken: members.publicToken })
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.associationId, associationId)))
    .limit(1);
  if (!member) throw new Error("الفرد غير موجود في هذه الجمعية");

  const selected = await db.select({ id: monthlyPayments.id, status: monthlyPayments.status })
    .from(monthlyPayments)
    .where(and(eq(monthlyPayments.memberId, memberId), inArray(monthlyPayments.id, paymentIds)));
  if (selected.length !== paymentIds.length) throw new Error("بعض الدفعات غير صالحة");
  if (selected.some((payment) => !["unpaid", "rejected"].includes(payment.status))) {
    throw new Error("إحدى الدفعات مدفوعة أو قيد المراجعة بالفعل");
  }

  await db.update(monthlyPayments).set({
    status: "paid",
    submissionId: null,
    updatedAt: new Date(),
  }).where(and(eq(monthlyPayments.memberId, memberId), inArray(monthlyPayments.id, paymentIds)));
  revalidatePath("/admin");
  revalidatePath(`/admin/associations/${associationId}`);
  revalidatePath(`/m/${member.publicToken}`);
}

export async function associationDetails(id: string) {
  const [association] = await db.select().from(associations).where(eq(associations.id, id)).limit(1);
  if (!association) return null;
  const memberRows = await db.select().from(members).where(eq(members.associationId, id)).orderBy(asc(members.createdAt));
  const ids = memberRows.map((member) => member.id);
  const [shareRows, paymentRows, submissions] = ids.length ? await Promise.all([
    db.select().from(shares).where(inArray(shares.memberId, ids)).orderBy(asc(shares.payoutOrder)),
    db.select().from(monthlyPayments).where(inArray(monthlyPayments.memberId, ids)),
    db.select().from(paymentSubmissions).where(inArray(paymentSubmissions.memberId, ids)).orderBy(sql`${paymentSubmissions.submittedAt} desc`),
  ]) : [[], [], []];
  return { association, members: memberRows, shares: shareRows, payments: paymentRows, submissions };
}
