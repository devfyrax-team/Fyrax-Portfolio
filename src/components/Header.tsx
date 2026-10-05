"use client";

import { List, X } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { site } from "@/content/site";

// Floating bar, detached from the top edge. The blur is fine here because it
// is a fixed element, not scrolling content.
export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (href: string) =>
    `relative py-1 text-sm font-medium transition-colors duration-300 ease-snap after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-brand-soft after:transition-transform after:duration-300 after:ease-snap hover:text-paper ${
      isActive(href)
        ? "text-paper after:scale-x-100"
        : "text-muted after:scale-x-0 hover:after:scale-x-100"
    }`;

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-6">
      <div className="clip-corner-sm mx-auto max-w-6xl bg-surface/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between pl-5 pr-3 sm:pl-6">
          <Link
            href="/"
            aria-label={`${site.name} home`}
            onClick={() => setOpen(false)}
          >
            <Image
              src="/logo.png"
              alt={site.name}
              width={705}
              height={332}
              priority
              className="h-9 w-auto"
            />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-9 md:flex">
            {site.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={linkClass(item.href)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={site.cta.href}
              className="clip-corner-sm whitespace-nowrap bg-brand-strong px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-300 ease-snap hover:bg-brand-deep active:scale-[0.98]"
            >
              {site.cta.label}
            </Link>
          </nav>

          <button
            type="button"
            className="p-3 text-paper md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X aria-hidden className="size-6" />
            ) : (
              <List aria-hidden className="size-6" />
            )}
          </button>
        </div>

        {open && (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="border-t border-line px-5 pb-6 pt-2 md:hidden"
          >
            <ul className="flex flex-col">
              {site.nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block border-b border-line py-4 font-display text-xl font-semibold tracking-tight ${
                      isActive(item.href) ? "text-brand-soft" : "text-paper"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={site.cta.href}
              onClick={() => setOpen(false)}
              className="clip-corner-sm mt-6 block bg-brand-strong px-6 py-3.5 text-center text-sm font-semibold text-white active:scale-[0.98]"
            >
              {site.cta.label}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
