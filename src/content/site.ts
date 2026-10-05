export const site = {
  name: "Fyrax",
  tagline: "Software that moves your business forward",
  description:
    "Fyrax is a software and IT agency. We design, build and run web apps, mobile apps and cloud systems for growing businesses.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "contact.fyrax@gmail.com",
  facebook: "https://www.facebook.com/profile.php?id=61584667771425",
  // Placeholder, replace with the real location.
  location: "Remote-first, working with clients worldwide",
  nav: [
    { href: "/services", label: "Services" },
    { href: "/projects", label: "Projects" },
    { href: "/about", label: "About" },
  ],
  // One label for the "get in touch" action, used everywhere on the site.
  cta: { href: "/contact", label: "Start a project" },
} as const;

export const processSteps = [
  {
    title: "Discover",
    text: "We start with your goals, users and constraints, and turn them into a clear scope and plan.",
  },
  {
    title: "Design",
    text: "Flows, wireframes and a visual design you can click through before any code is written.",
  },
  {
    title: "Build",
    text: "Short iterations with a working demo at the end of each one, so you always see progress.",
  },
  {
    title: "Launch and support",
    text: "We deploy, monitor and keep improving the product after it goes live.",
  },
] as const;
