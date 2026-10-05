import nodemailer from "nodemailer";
import { site } from "@/content/site";
import type { ContactInput } from "@/lib/validation";

const user = process.env.GMAIL_USER;
// Google shows app passwords in groups of four separated by spaces.
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

const transporter =
  user && pass
    ? nodemailer.createTransport({ service: "gmail", auth: { user, pass } })
    : null;

const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

// Emails the enquiry to the company inbox. Does nothing until the Gmail
// credentials are set in .env; the enquiry is saved to the database either way.
export async function sendEnquiryNotification(enquiry: ContactInput) {
  if (!transporter || !user) return false;

  const name = oneLine(enquiry.name);

  await transporter.sendMail({
    from: `"${site.name} website" <${user}>`,
    to: process.env.NOTIFY_EMAIL || user,
    replyTo: { name, address: enquiry.email },
    subject: `New enquiry from ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${enquiry.email}`,
      `Company: ${oneLine(enquiry.company) || "-"}`,
      "",
      enquiry.message,
      "",
      `View all enquiries: ${site.url}/admin/messages`,
    ].join("\n"),
  });

  return true;
}
