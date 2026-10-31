import { describe, expect, it } from "vitest";
import { checkUrl, isPrivateIp, urlDedupKey } from "./url-safety";

describe("checkUrl", () => {
  it.each([
    "https://example.com",
    "http://example.org/path?q=1",
    "https://sub.domain.co.in/a/b#frag",
    "https://8.8.8.8/",
    "https://[2606:4700:4700::1111]/",
  ])("accepts public URL %s", (u) => {
    expect(checkUrl(u).ok).toBe(true);
  });

  it.each([
    ["ftp://example.com/file", /http and https/],
    ["javascript:alert(1)", /http and https/],
    ["file:///etc/passwd", /http and https/],
    ["data:text/html,hi", /http and https/],
    ["not a url", /valid URL/],
    ["", /empty/],
    ["https://user:pass@example.com", /credentials/],
  ])("rejects %s", (u, reason) => {
    const r = checkUrl(u);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(reason);
  });

  it.each([
    "http://localhost:3000",
    "http://LOCALHOST",
    "http://app.localhost",
    "http://printer.local",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://127.0.0.1",
    "http://127.1.2.3:8080",
    "http://10.0.0.5",
    "http://172.16.0.1",
    "http://172.31.255.255",
    "http://192.168.1.1",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1",
    "http://0.0.0.0",
    "http://224.0.0.1",
    "http://[::1]/",
    "http://[::]/",
    "http://[fc00::1]/",
    "http://[fd12:3456::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://2130706433/", // 127.0.0.1 as decimal
    "http://0x7f000001/", // 127.0.0.1 as hex
    "http://017700000001/", // octal
    "http://intranet/",
  ])("blocks private/internal host %s (SSRF)", (u) => {
    expect(checkUrl(u).ok).toBe(false);
  });

  it("does not block public IPs that merely look similar", () => {
    expect(checkUrl("http://172.32.0.1").ok).toBe(true);
    expect(checkUrl("http://192.169.0.1").ok).toBe(true);
    expect(checkUrl("http://11.0.0.1").ok).toBe(true);
  });

  it("strips the fragment when normalising", () => {
    const r = checkUrl("https://example.com/a#section");
    expect(r.ok && r.normalized).toBe("https://example.com/a");
  });
});

describe("isPrivateIp", () => {
  it("classifies resolved addresses for DNS-rebinding checks", () => {
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("64:ff9b::7f00:1")).toBe(true); // NAT64 of 127.0.0.1
    expect(isPrivateIp("93.184.216.34")).toBe(false);
    expect(isPrivateIp("2606:4700::6810:84e5")).toBe(false);
  });
});

describe("urlDedupKey", () => {
  it("treats trailing slashes, case of host and fragments as duplicates", () => {
    const a = checkUrl("https://Example.com/page/");
    const b = checkUrl("https://example.com/page#x");
    if (!a.ok || !b.ok) throw new Error("expected valid");
    expect(urlDedupKey(a.url)).toBe(urlDedupKey(b.url));
  });

  it("keeps different query strings distinct", () => {
    const a = checkUrl("https://example.com/p?id=1");
    const b = checkUrl("https://example.com/p?id=2");
    if (!a.ok || !b.ok) throw new Error("expected valid");
    expect(urlDedupKey(a.url)).not.toBe(urlDedupKey(b.url));
  });
});
