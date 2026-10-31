import { z } from "zod";
import { checkUrl } from "./url-safety";

export const MAX_SOURCES = 12;
export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB
export const ACCEPTED_PDF_MIME = "application/pdf";

export const safeUrlSchema = z
  .string()
  .trim()
  .superRefine((val, ctx) => {
    const r = checkUrl(val);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.reason });
  })
  .transform((val) => {
    const r = checkUrl(val);
    return r.ok ? r.normalized : val;
  });

export const researchBriefSchema = z.object({
  topic: z.string().trim().min(3, "Topic must be at least 3 characters.").max(200),
  question: z.string().trim().min(10, "Question must be at least 10 characters.").max(1000),
  objective: z.string().trim().max(1000).optional().default(""),
});
export type ResearchBrief = z.infer<typeof researchBriefSchema>;

export type PdfCheck = { ok: true } | { ok: false; reason: string };

export function checkPdfFile(file: { name: string; type: string; size: number }): PdfCheck {
  const isPdfName = file.name.toLowerCase().endsWith(".pdf");
  if (file.type !== ACCEPTED_PDF_MIME && !(file.type === "" && isPdfName)) {
    return { ok: false, reason: `${file.name}: only PDF files are accepted.` };
  }
  if (file.size === 0) return { ok: false, reason: `${file.name}: file is empty.` };
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, reason: `${file.name}: exceeds ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB limit.` };
  }
  return { ok: true };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
