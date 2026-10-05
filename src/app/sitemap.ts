import type { MetadataRoute } from "next";
import { projects } from "@/content/projects";
import { site } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/services", "/projects", "/about", "/contact"];

  return [
    ...pages.map((path) => ({ url: `${site.url}${path}` })),
    ...projects.map((project) => ({
      url: `${site.url}/projects/${project.slug}`,
    })),
  ];
}
