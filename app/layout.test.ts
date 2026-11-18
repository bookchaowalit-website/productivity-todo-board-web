import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSitemap } from "@/lib/site";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font-geist" }) }));

async function loadLayout(siteUrl: string | undefined) {
  vi.resetModules();
  if (siteUrl === undefined) vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
  else vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteUrl);
  const site = await import("@/lib/site");
  const layout = await import("./layout");
  return { site, metadata: layout.metadata };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("root layout metadata", () => {
  it("uses the sitemap home URL as canonical when the site URL has a base path", async () => {
    const { site, metadata } = await loadLayout("https://example.test/app/");
    expect(metadata.alternates?.canonical).toBe("https://example.test/app");
    expect(metadata.alternates?.canonical).toBe(site.buildSitemap()[0].url);
  });

  it("uses the default origin as canonical when the site URL is unset", async () => {
    const { metadata } = await loadLayout(undefined);
    expect(metadata.alternates?.canonical).toBe("https://todo-board.bookchaowalit.com");
    expect(metadata.alternates?.canonical).toBe(buildSitemap("https://todo-board.bookchaowalit.com")[0].url);
  });
});
