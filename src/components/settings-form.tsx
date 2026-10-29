"use client";

import { useActionState } from "react";
import { updateCredentials, type AuthState } from "@/actions/auth";

export function SettingsForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState(updateCredentials, {} as AuthState);
  return <form action={action} className="form-card"><label>اسم المستخدم<input name="username" defaultValue={username} minLength={3} required /></label><label>كلمة المرور الحالية<input name="currentPassword" type="password" required /></label><label>كلمة مرور جديدة <small>(اختياري)</small><input name="newPassword" type="password" minLength={8} /></label>{state.error && <p className={state.error.startsWith("تم") ? "form-success" : "form-error"}>{state.error}</p>}<button className="button primary" disabled={pending}>{pending ? "جاري الحفظ..." : "حفظ التغييرات"}</button></form>;
}
