import { FacebookLogo } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";

const linkClass =
  "text-muted transition-colors duration-300 ease-snap hover:text-paper";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Image
            src="/logo.png"
            alt={site.name}
            width={705}
            height={332}
            className="h-10 w-auto"
          />
          <p className="mt-5 max-w-[34ch] leading-7 text-muted">
            {site.description}
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="font-display font-semibold">Explore</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={site.cta.href} className={linkClass}>
                {site.cta.label}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="font-display font-semibold">Contact</h2>
          <ul className="mt-5 space-y-3 text-sm">
            <li>
              <a href={`mailto:${site.email}`} className={linkClass}>
                {site.email}
              </a>
            </li>
            <li>
              <a
                href={site.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 ${linkClass}`}
              >
                <FacebookLogo aria-hidden className="size-5" />
                Facebook
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line/60">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted sm:px-6">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
