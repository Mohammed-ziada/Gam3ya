"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { formatMoney } from "@/lib/format";

type PaymentOption = { id: string; label: string; amount: number; overdue: boolean };

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("اختار صورة صحيحة");
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذّر تجهيز الصورة");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("تعذّر ضغط الصورة")), "image/jpeg", 0.78));
}

export function PaymentUpload({ token, options }: { token: string; options: PaymentOption[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const amount = useMemo(() => options.filter((option) => selected.includes(option.id)).reduce((sum, option) => sum + option.amount, 0), [options, selected]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!selected.length) return setError("اختار شهرًا واحدًا على الأقل");
    if (!file) return setError("ارفع صورة التحويل");
    setStatus("loading");
    try {
      const compressed = await compressImage(file);
      const body = new FormData();
      body.set("proof", new File([compressed], "proof.jpg", { type: "image/jpeg" }));
      selected.forEach((id) => body.append("paymentIds", id));
      const response = await fetch(`/api/member/${token}/payments`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذّر رفع الإثبات");
      setStatus("success");
      window.setTimeout(() => window.location.reload(), 1300);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "حدث خطأ غير متوقع");
      setStatus("idle");
    }
  }

  if (options.length === 0) return <div className="all-paid"><CheckCircle2 /><div><strong>مفيش دفعات مطلوبة حاليًا</strong><span>كل الدفعات مرفوعة أو مسجلة.</span></div></div>;

  return <form className="upload-card" onSubmit={submit}>
    <div className="upload-heading"><div><span className="step-number">1</span><div><h2>اختار الشهور</h2><p>تقدر تختار شهرًا واحدًا أو تدفع مقدمًا لأكثر من شهر.</p></div></div><strong>{formatMoney(amount)}</strong></div>
    <div className="month-options">{options.map((option) => <label className={`month-option ${selected.includes(option.id) ? "selected" : ""}`} key={option.id}><input type="checkbox" checked={selected.includes(option.id)} onChange={() => toggle(option.id)} /><span><b>{option.label}</b>{option.overdue && <small>متأخر</small>}</span><strong>{formatMoney(option.amount)}</strong></label>)}</div>
    <div className="upload-heading second"><div><span className="step-number">2</span><div><h2>ارفع صورة التحويل</h2><p>الصورة لا يراها إلا منظّم الجمعية.</p></div></div></div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
    <button type="button" className={`file-drop ${file ? "has-file" : ""}`} onClick={() => inputRef.current?.click()}><ImagePlus /><strong>{file ? file.name : "اختار صورة التحويل"}</strong><span>{file ? "اضغط لتغيير الصورة" : "JPG أو PNG أو WEBP"}</span></button>
    {error && <p className="form-error">{error}</p>}
    <button className="button primary full large" disabled={status === "loading" || status === "success"}>{status === "loading" ? <><Loader2 className="spin" /> جاري الرفع...</> : status === "success" ? <><CheckCircle2 /> تم الرفع بنجاح</> : <><UploadCloud /> رفع الإثبات للمراجعة</>}</button>
  </form>;
}
