"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, setupAdmin, type AuthState } from "@/actions/auth";

const initialState: AuthState = {};

export function AuthForm({ mode }: { mode: "setup" | "login" }) {
  const [state, action, pending] = useActionState(mode === "setup" ? setupAdmin : login, initialState);

  if (state.recoveryCode) {
    return (
      <div className="auth-card">
        <span className="eyebrow">تم إنشاء الحساب</span>
        <h1>احتفظ بكود الاسترداد</h1>
        <p className="muted">سيظهر هذا الكود مرة واحدة فقط. خزّنه في مكان آمن.</p>
        <code className="recovery-code" dir="ltr">{state.recoveryCode}</code>
        <Link className="button primary full" href="/admin">دخول لوحة التحكم</Link>
      </div>
    );
  }

  return (
    <form action={action} className="auth-card">
      <div className="brand-mark">ج</div>
      <span className="eyebrow">{mode === "setup" ? "إعداد أول مرة" : "لوحة المنظّم"}</span>
      <h1>{mode === "setup" ? "أنشئ حساب المنظّم" : "أهلًا بعودتك"}</h1>
      <p className="muted">{mode === "setup" ? "اختار بيانات دخول خاصة بك. تقدر تغيّرها بعدين." : "أدخل بياناتك للوصول إلى الجمعيات."}</p>
      <label>اسم المستخدم<input name="username" autoComplete="username" required minLength={3} /></label>
      <label>كلمة المرور<input name="password" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} required minLength={8} /></label>
      {state.error && <p className="form-error">{state.error}</p>}
      <button className="button primary full" disabled={pending}>{pending ? "جاري الحفظ..." : mode === "setup" ? "إنشاء الحساب" : "تسجيل الدخول"}</button>
    </form>
  );
}
