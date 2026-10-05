import Image from "next/image";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function AdminLoginPage() {
  if (await isAuthenticated()) redirect("/admin/messages");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-16">
      <Image
        src="/logo.png"
        alt="Fyrax"
        width={705}
        height={332}
        priority
        className="h-10 w-auto self-start"
      />
      <h1 className="mt-10 font-display text-2xl font-semibold tracking-tight">
        Admin sign in
      </h1>
      <p className="mt-2 text-muted">Sign in to read contact enquiries.</p>
      <LoginForm />
    </div>
  );
}
