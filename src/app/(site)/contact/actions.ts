"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { sendEnquiryNotification } from "@/lib/mail";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { contactSchema } from "@/lib/validation";

type Fields = "name" | "email" | "company" | "message";

export type ContactState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<Fields, string[]>>;
  values?: Record<Fields, string>;
};

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const values = {
    name: text(formData, "name"),
    email: text(formData, "email"),
    company: text(formData, "company"),
    message: text(formData, "message"),
  };

  // Honeypot: real visitors never see or fill this field. Pretend it worked.
  if (text(formData, "website")) {
    return { status: "success" };
  }

  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  if (!rateLimit(`contact:${await clientIp()}`, 5, 10 * 60 * 1000)) {
    return {
      status: "error",
      message: "Too many messages in a short time. Please try again later.",
      values,
    };
  }

  try {
    await db.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        company: parsed.data.company || null,
        message: parsed.data.message,
      },
    });
  } catch (error) {
    console.error("Failed to save contact message", error);
    return {
      status: "error",
      message: "Something went wrong on our side. Please try again.",
      values,
    };
  }

  // The enquiry is already saved, so a mail failure must not fail the form.
  try {
    await sendEnquiryNotification(parsed.data);
  } catch (error) {
    console.error("Failed to send enquiry notification email", error);
  }

  return { status: "success" };
}
