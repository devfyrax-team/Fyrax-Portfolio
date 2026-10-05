export type Project = {
  slug: string;
  title: string;
  client: string;
  year: string;
  category: string;
  summary: string;
  tags: string[];
  challenge: string;
  solution: string;
  outcomes: string[];
  featured?: boolean;
  /** Path of an interactive demo served from /public, shown on the project page. */
  demoUrl?: string;
  /** Screenshot in /public used as the card cover instead of the generated artwork. */
  image?: string;
};

// Placeholder case studies. Replace with real client work.
export const projects: Project[] = [
  {
    slug: "hrms",
    title: "HRMS platform",
    client: "Multi-company HR product",
    year: "2026",
    category: "Web application",
    summary:
      "A multi-company HR system covering employees, leave, attendance, payroll, recruitment and performance in one place.",
    tags: ["React", "TypeScript", "Express", "PostgreSQL", "Prisma", "Docker"],
    challenge:
      "HR teams were juggling spreadsheets for leave, attendance and payroll, and approvals travelled by email, so nothing had a single source of truth.",
    solution:
      "We built one system with role-based access for HR, managers and employees: configurable approval flows, payroll runs with payslips, a recruitment pipeline, performance cycles and per-seat billing for each company.",
    outcomes: [
      "Leave, attendance and payroll in a single system",
      "Approvals routed automatically to the right person",
      "Each company's data kept separate, billed per seat",
    ],
    featured: true,
    demoUrl: "/demos/hrms/",
    image: "/projects/hrms-cover.png",
  },
  {
    slug: "fleet-tracking-dashboard",
    title: "Fleet tracking dashboard",
    client: "Logistics company",
    year: "2026",
    category: "Web application",
    summary:
      "A live operations dashboard that shows where every vehicle is and which deliveries are at risk.",
    tags: ["Next.js", "PostgreSQL", "Maps", "WebSockets"],
    challenge:
      "Dispatchers were tracking vehicles over phone calls and spreadsheets. Delays were only noticed after a customer complained.",
    solution:
      "We built a real-time dashboard fed by GPS devices already installed in the fleet. Dispatchers see a live map, delivery status and automatic alerts when a route falls behind schedule.",
    outcomes: [
      "One screen replaces phone calls and spreadsheets",
      "Late deliveries flagged before the customer notices",
      "Daily reports generated automatically",
    ],
    featured: true,
  },
  {
    slug: "clinic-booking-app",
    title: "Clinic booking app",
    client: "Healthcare group",
    year: "2025",
    category: "Mobile app",
    summary:
      "A patient app for booking appointments, receiving reminders and viewing visit history.",
    tags: ["React Native", "Node.js", "Push notifications"],
    challenge:
      "Appointments were booked by phone during office hours only, and missed appointments were common.",
    solution:
      "We delivered an iOS and Android app connected to the clinic's existing scheduling system, with reminders and one-tap rescheduling.",
    outcomes: [
      "Bookings available around the clock",
      "Automatic reminders reduce missed appointments",
      "Front-desk staff freed from routine calls",
    ],
    featured: true,
  },
  {
    slug: "online-store-rebuild",
    title: "Online store rebuild",
    client: "Retail brand",
    year: "2025",
    category: "E-commerce",
    summary:
      "A faster storefront with a simpler checkout and inventory synced to the warehouse system.",
    tags: ["Next.js", "Stripe", "Headless CMS"],
    challenge:
      "The old store was slow on mobile, and stock levels were updated by hand, so customers could order items that were sold out.",
    solution:
      "We rebuilt the storefront on a modern stack, cut the checkout to three steps and connected stock levels directly to the warehouse system.",
    outcomes: [
      "Pages load quickly on mobile connections",
      "Checkout reduced from six steps to three",
      "Stock levels always match the warehouse",
    ],
    featured: true,
  },
  {
    slug: "invoice-automation",
    title: "Invoice automation",
    client: "Accounting firm",
    year: "2024",
    category: "Automation",
    summary:
      "An internal tool that reads incoming invoices and posts them to the accounting system.",
    tags: ["Python", "OCR", "REST API"],
    challenge:
      "Staff retyped supplier invoices into the accounting system by hand, which was slow and error-prone.",
    solution:
      "We built a pipeline that extracts invoice data, validates it against purchase orders and queues only the exceptions for human review.",
    outcomes: [
      "Routine invoices processed without manual entry",
      "Staff review only the exceptions",
      "Full audit trail for every document",
    ],
  },
  {
    slug: "cloud-migration",
    title: "Cloud migration",
    client: "SaaS startup",
    year: "2024",
    category: "Cloud & DevOps",
    summary:
      "Moving a growing product from a single server to an automated, monitored cloud setup.",
    tags: ["AWS", "Docker", "CI/CD", "Terraform"],
    challenge:
      "Releases were manual and risky, and a single server was a single point of failure.",
    solution:
      "We containerised the application, defined the infrastructure as code and set up a pipeline that tests and deploys every change automatically.",
    outcomes: [
      "Releases go out in minutes instead of an evening",
      "No single point of failure",
      "Monitoring and alerts in place from day one",
    ],
  },
];

export const featuredProjects = projects.filter((p) => p.featured);

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
