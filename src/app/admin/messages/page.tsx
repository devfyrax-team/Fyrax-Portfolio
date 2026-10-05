import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout, setMessageRead } from "../actions";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminMessagesPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");

  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });
  const unread = messages.filter((m) => !m.read).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Enquiries
          </h1>
          <p className="mt-1 text-muted">
            {messages.length} total · {unread} unread
          </p>
        </div>
        <div className="flex items-center gap-5 text-sm font-medium">
          <Link href="/" className="text-muted hover:text-paper">
            View site
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="clip-corner-sm bg-surface-2 px-4 py-2.5 hover:bg-line"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {messages.length === 0 ? (
        <p className="clip-corner mt-10 bg-surface p-8 text-muted">
          No enquiries yet. Messages sent through the contact form will appear
          here.
        </p>
      ) : (
        <ul className="mt-10 space-y-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`clip-corner border-l-2 bg-surface p-6 ${
                m.read ? "border-line" : "border-brand"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold">
                    {m.name}
                    {!m.read && (
                      <span className="ml-3 bg-brand/15 px-2 py-0.5 align-middle text-xs font-semibold uppercase tracking-wider text-brand-soft">
                        New
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 break-words text-sm text-muted">
                    <a
                      href={`mailto:${m.email}`}
                      className="text-brand-soft hover:underline"
                    >
                      {m.email}
                    </a>
                    {m.company && <> · {m.company}</>}
                  </p>
                </div>
                <time
                  dateTime={m.createdAt.toISOString()}
                  className="text-sm text-muted"
                >
                  {dateFormat.format(m.createdAt)}
                </time>
              </div>

              <p className="mt-4 whitespace-pre-wrap break-words leading-7">
                {m.message}
              </p>

              <form
                action={setMessageRead.bind(null, m.id, !m.read)}
                className="mt-5"
              >
                <button
                  type="submit"
                  className="text-sm font-medium text-muted underline-offset-4 hover:text-paper hover:underline"
                >
                  {m.read ? "Mark as unread" : "Mark as read"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
