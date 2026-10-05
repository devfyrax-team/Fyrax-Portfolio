import type { ComponentType } from "react";
import {
  CloudArrowUp,
  DeviceMobile,
  FlowArrow,
  Globe,
  Lifebuoy,
  PenNib,
} from "@phosphor-icons/react/ssr";

export type Service = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  deliverables: string[];
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

export const services: Service[] = [
  {
    slug: "web-development",
    title: "Web development",
    summary: "Fast, accessible websites and web apps built to scale.",
    description:
      "From marketing sites to complex dashboards and customer portals. We build with modern frameworks, test what we ship, and keep performance and accessibility in view from the first commit.",
    deliverables: [
      "Company and marketing websites",
      "Web applications and dashboards",
      "E-commerce and booking systems",
      "API design and integration",
    ],
    icon: Globe,
  },
  {
    slug: "mobile-apps",
    title: "Mobile apps",
    summary: "iOS and Android apps from a single, maintainable codebase.",
    description:
      "Cross-platform apps that feel native, work offline where it matters, and share a backend with your web product so you maintain one system instead of three.",
    deliverables: [
      "Cross-platform iOS and Android apps",
      "Offline-first data sync",
      "Push notifications and in-app payments",
      "App Store and Play Store release",
    ],
    icon: DeviceMobile,
  },
  {
    slug: "ui-ux-design",
    title: "UI/UX design",
    summary: "Interfaces people understand the first time they use them.",
    description:
      "We map user journeys, prototype early and test with real users. The result is a design system your team can keep building on, not a set of one-off screens.",
    deliverables: [
      "User research and journey mapping",
      "Wireframes and clickable prototypes",
      "Visual design and design systems",
      "Usability testing",
    ],
    icon: PenNib,
  },
  {
    slug: "cloud-devops",
    title: "Cloud & DevOps",
    summary: "Reliable infrastructure with automated, repeatable releases.",
    description:
      "We set up hosting, CI/CD pipelines, monitoring and backups so releases are routine and outages are rare. Infrastructure is defined as code and documented.",
    deliverables: [
      "Cloud architecture and migration",
      "CI/CD pipelines",
      "Monitoring, logging and alerting",
      "Security hardening and backups",
    ],
    icon: CloudArrowUp,
  },
  {
    slug: "automation",
    title: "Automation & integrations",
    summary: "Connect your tools and remove repetitive manual work.",
    description:
      "We link the systems you already use (CRM, accounting, inventory, messaging) and automate the hand-offs between them, so your team spends time on work that needs people.",
    deliverables: [
      "Workflow automation",
      "Third-party API integrations",
      "Internal tools and admin panels",
      "Data pipelines and reporting",
    ],
    icon: FlowArrow,
  },
  {
    slug: "support",
    title: "Maintenance & support",
    summary: "Ongoing care for software that is already in production.",
    description:
      "Updates, bug fixes, performance work and new features on a predictable monthly plan. We also take over and stabilise projects started by other teams.",
    deliverables: [
      "Bug fixes and security updates",
      "Performance optimisation",
      "Feature development on retainer",
      "Code audits and takeovers",
    ],
    icon: Lifebuoy,
  },
];
