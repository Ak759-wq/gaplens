import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { assertPublicHost } from "@/server/net/safeFetch";
import { extractPdfUpload, extractUrl, markdownToText } from "./sourceExtractor";

const fixtures = join(process.cwd(), "tests/fixtures");
const NOW = new Date("2026-10-31T00:00:00Z");
const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];

function html(body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...headers } });
}

describe("assertPublicHost", () => {
  it("rejects hosts that resolve to private addresses (DNS rebinding)", async () => {
    await expect(assertPublicHost("evil.example", async () => [{ address: "127.0.0.1", family: 4 }])).rejects.toThrow(/private/);
    await expect(assertPublicHost("evil.example", async () => [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }])).rejects.toThrow();
    await expect(assertPublicHost("v6.example", async () => [{ address: "::ffff:169.254.169.254", family: 6 }])).rejects.toThrow();
  });
  it("accepts public hosts and literal public IPs", async () => {
    await expect(assertPublicHost("example.org", publicDns)).resolves.toBeUndefined();
    await expect(assertPublicHost("8.8.8.8")).resolves.toBeUndefined();
    await expect(assertPublicHost("169.254.169.254")).rejects.toThrow();
  });
});

describe("extractUrl", () => {
  it("falls back from Jina to a direct fetch and parses HTML metadata", async () => {
    const page = readFileSync(join(fixtures, "gov-scholarship.html"), "utf8");
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const u = String(input);
      if (u.startsWith("https://r.jina.ai/")) return new Response('{"code":401,"message":"bad IP reputation"}', { status: 401 });
      return html(page);
    });
    const doc = await extractUrl("https://socialjustice.example.gov.in/pms", { fetchImpl, lookupImpl: publicDns, now: NOW, env: {} as NodeJS.ProcessEnv });
    expect(doc.provider).toBe("direct");
    expect(doc.title).toBe("Post Matric Scholarship for SC Students");
    expect(doc.publishedAt).toBe("2024-07-01");
    expect(doc.modifiedAt).toBe("2025-03-12");
    expect(doc.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses Jina JSON output when available and strips markdown syntax", async () => {
    const content = "# Scheme\n\nThe **income limit** is Rs. 2.5 lakh. [Apply here](https://x.example/apply)\n\n" + "More detail about eligibility and documents. ".repeat(10);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).startsWith("https://r.jina.ai/")) {
        return new Response(JSON.stringify({ code: 200, data: { title: "Scheme page", content, url: "https://a.example/p", publishedTime: "2025-08-01T00:00:00Z" } }), { status: 200 });
      }
      throw new Error("no direct fetch expected");
    });
    const doc = await extractUrl("https://a.example/p", { fetchImpl, lookupImpl: publicDns, now: NOW, env: { JINA_API_KEY: "k" } as unknown as NodeJS.ProcessEnv });
    expect(doc.provider).toBe("jina");
    expect(doc.text).toContain("The income limit is Rs. 2.5 lakh. Apply here");
    expect(doc.publishedAt).toBe("2025-08-01");
    const auth = (fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer k");
  });

  it("refuses private targets before any provider is called", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(extractUrl("https://internal.example/", { fetchImpl, lookupImpl: async () => [{ address: "192.168.1.2", family: 4 }] })).rejects.toThrow(/private/);
    await expect(extractUrl("http://localhost:3000/")).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks redirects to private addresses", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const u = String(input);
      if (u.startsWith("https://r.jina.ai/")) return new Response("x", { status: 500 });
      return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    });
    await expect(extractUrl("https://redirector.example/", { fetchImpl, lookupImpl: publicDns, env: {} as NodeJS.ProcessEnv })).rejects.toThrow(/not allowed|private|reserved/i);
  });

  it("reports a clear failure when every provider fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("nope", { status: 503 }));
    await expect(extractUrl("https://down.example/", { fetchImpl, lookupImpl: publicDns, env: {} as NodeJS.ProcessEnv })).rejects.toThrow(/jina: .*503.*direct: HTTP 503/s);
  });

  it("treats near-empty pages (JS shells) as failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) =>
      String(input).startsWith("https://r.jina.ai/") ? new Response("", { status: 500 }) : html("<html><body><div id=root></div></body></html>"),
    );
    await expect(extractUrl("https://spa.example/", { fetchImpl, lookupImpl: publicDns, env: {} as NodeJS.ProcessEnv })).rejects.toThrow(/characters of text/);
  });
});

describe("markdownToText", () => {
  it("removes images, link targets and table rules", () => {
    expect(markdownToText("![logo](a.png)\n| a | b |\n|---|---|\n| 1 | 2 |\n[Read](https://x)")).toBe("| a | b |\n| 1 | 2 |\nRead");
  });
});

describe("extractPdfUpload (fixture)", () => {
  it("extracts text, title and dates from a PDF", async () => {
    const bytes = new Uint8Array(readFileSync(join(fixtures, "notification.pdf")));
    const doc = await extractPdfUpload(bytes, { now: NOW });
    expect(doc.provider).toBe("pdf-parse");
    expect(doc.text).toContain("academic year 2025-26");
    expect(doc.text).toMatch(/last date to apply is 31 July 2025/);
    expect(doc.title).toBe("Merit Scholarship Notification 2025-26");
    expect(doc.publishedAt).toBe("2025-06-10");
  });
  it("rejects non-PDF bytes", async () => {
    await expect(extractPdfUpload(new TextEncoder().encode("hello world"))).rejects.toThrow(/not a valid PDF/);
  });
});
