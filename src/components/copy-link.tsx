"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    await navigator.clipboard.writeText(`${base}/m/${token}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <button type="button" className="icon-button" onClick={copy} title="نسخ رابط الفرد">{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? "تم النسخ" : "نسخ الرابط"}</button>;
}
