import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { paymentSubmissions } from "@/lib/schema";
import { signedProofUrl } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) redirect("/login");
  const { id } = await params;
  const [submission] = await db.select().from(paymentSubmissions).where(eq(paymentSubmissions.id, id)).limit(1);
  if (!submission) return new Response("Not found", { status: 404 });
  redirect(await signedProofUrl(submission.proofKey));
}
