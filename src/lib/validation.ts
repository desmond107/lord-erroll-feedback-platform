import { z } from "zod";
import { CATEGORY_KEYS, HIGHLIGHTS, IMPROVEMENTS, OCCASIONS, SECTION_SLUGS } from "./config";

const rating = z.number().int().min(1).max(5).nullable().optional();
const trimmed = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const TABLE_RE = /^[A-Za-z0-9-]{1,8}$/;

export const submissionSchema = z.object({
  clientId: z.string().uuid(),
  lang: z.enum(["en", "sw"]).default("en"),
  section: z.enum(SECTION_SLUGS as [string, ...string[]]),
  table: z.string().trim().regex(TABLE_RE).optional().nullable().or(z.literal("")).transform((v) => v || null),
  occasion: z.enum(OCCASIONS.map((o) => o.key) as [string, ...string[]]).nullable().optional(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overall: z.number().int().min(1).max(5),
  ratings: z.object(Object.fromEntries(CATEGORY_KEYS.map((k) => [k, rating])) as Record<(typeof CATEGORY_KEYS)[number], typeof rating>).partial(),
  highlights: z.array(z.enum(HIGHLIGHTS.map((h) => h.key) as [string, ...string[]])).max(HIGHLIGHTS.length).default([]),
  improvements: z.array(z.enum(IMPROVEMENTS.map((h) => h.key) as [string, ...string[]])).max(IMPROVEMENTS.length).default([]),
  staffName: trimmed(80),
  staffMessage: trimmed(500),
  suggestion: trimmed(4000),
  nps: z.number().int().min(0).max(10).nullable().optional(),
  guestName: trimmed(100),
  guestEmail: z.string().trim().max(200).email().optional().nullable().or(z.literal("")).transform((v) => v || null),
  guestPhone: z.string().trim().max(30).regex(/^[+\d\s()-]{7,30}$/).optional().nullable().or(z.literal("")).transform((v) => v || null),
  followUp: z.boolean().default(false),
  startedAt: z.number().int(),
  website: z.string().optional(), // honeypot — humans never see this field
});

export type Submission = z.infer<typeof submissionSchema>;
