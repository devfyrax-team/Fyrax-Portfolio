import { z } from "zod";

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(100, "Name is too long."),
  email: z
    .string()
    .trim()
    .max(200, "Email is too long.")
    .pipe(z.email("Please enter a valid email address.")),
  company: z.string().trim().max(100, "Company name is too long."),
  message: z
    .string()
    .trim()
    .min(10, "Please tell us a little more (at least 10 characters).")
    .max(5000, "Message is too long (5000 characters max)."),
});

export type ContactInput = z.infer<typeof contactSchema>;
