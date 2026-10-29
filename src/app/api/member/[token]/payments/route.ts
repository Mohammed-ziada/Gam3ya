import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { members, monthlyPayments, paymentSubmissions } from "@/lib/schema";
import { uploadPrivateFile } from "@/lib/storage";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const [member] = await db.select().from(members).where(and(eq(members.publicToken, token), eq(members.active, true))).limit(1);
    if (!member) return NextResponse.json({ error: "الرابط غير صالح" }, { status: 404 });

    const form = await request.formData();
    const proof = form.get("proof");
    const paymentIds = form.getAll("paymentIds").map(String);
    if (!(proof instanceof File) || !paymentIds.length) return NextResponse.json({ error: "اختار الشهور وصورة التحويل" }, { status: 400 });
    const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || 2 * 1024 * 1024);
    if (!allowedTypes.has(proof.type) || proof.size > maxBytes) return NextResponse.json({ error: "الصورة غير صالحة أو حجمها كبير" }, { status: 400 });

    const selected = await db.select().from(monthlyPayments).where(and(
      eq(monthlyPayments.memberId, member.id),
      inArray(monthlyPayments.id, paymentIds),
    ));
    if (selected.length !== new Set(paymentIds).size || selected.some((payment) => !["unpaid", "rejected"].includes(payment.status))) {
      return NextResponse.json({ error: "إحدى الدفعات لم تعد متاحة، حدّث الصفحة" }, { status: 409 });
    }

    const amount = selected.reduce((sum, payment) => sum + payment.amount, 0);
    const key = `proofs/${member.associationId}/${member.id}/${crypto.randomUUID()}.jpg`;
    await uploadPrivateFile(key, new Uint8Array(await proof.arrayBuffer()), proof.type);
    const [submission] = await db.insert(paymentSubmissions).values({ memberId: member.id, amount, proofKey: key }).returning({ id: paymentSubmissions.id });
    await db.update(monthlyPayments).set({ status: "pending", submissionId: submission.id, updatedAt: new Date() }).where(inArray(monthlyPayments.id, paymentIds));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("payment upload failed", error);
    return NextResponse.json({ error: "تعذّر رفع الإثبات، حاول مرة أخرى" }, { status: 500 });
  }
}
