"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkPassword,
  createSession,
  destroySession,
  isAuthenticated,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!rateLimit(`login:${await clientIp()}`, 5, 15 * 60 * 1000)) {
    return { error: "Too many attempts. Please wait 15 minutes." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !checkPassword(password)) {
    return { error: "Incorrect password." };
  }

  await createSession();
  redirect("/admin/messages");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

export async function setMessageRead(id: string, read: boolean) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  await db.contactMessage.update({ where: { id }, data: { read } });
  revalidatePath("/admin/messages");
}
