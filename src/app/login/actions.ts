"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  step: "email" | "code";
  email: string;
  error?: string;
};

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

export async function sendLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = cleanEmail(formData.get("email"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { step: "email", email, error: "That doesn't look like an email address." };
  }

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("email_is_allowed", { p_email: email });
  if (!allowed) {
    return { step: "email", email, error: "This app is private. That email isn't on the list." };
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: true },
  });
  if (error) {
    return { step: "email", email, error: friendlyAuthError(error.message) };
  }
  return { step: "code", email };
}

export type VerifyState = { error?: string };

export async function verifyCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const email = cleanEmail(formData.get("email"));
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) {
    return { error: "Enter the code from the email (numbers only)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { error: "That code didn't work. It may have expired, so try sending a new one." };
  }
  redirect("/");
}

function friendlyAuthError(message: string) {
  if (/rate limit|seconds/i.test(message)) {
    return "An email was just sent. Wait a minute before asking for another.";
  }
  return message;
}
