// Restaurant facts, seating plan and feedback vocabulary.
// Everything guest-visible is keyed so the stored value never changes when wording does.

export const RESTAURANT = {
  name: "The Lord Erroll",
  fullName: "The Lord Erroll Gourmet Restaurant",
  address: "89 Ruaka Road, Nairobi",
  phone: "+254 721 920820",
  phoneHref: "tel:+254721920820",
  email: "reservations@lord-erroll.com",
  website: "lord-erroll.com",
  websiteHref: "https://lord-erroll.com",
  timezone: "Africa/Nairobi",
} as const;

export const SECTIONS = [
  { slug: "bar-side", en: "Bar side", sw: "Upande wa Baa" },
  { slug: "west-wing", en: "West Wing", sw: "Mrengo wa Magharibi" },
  { slug: "east-wing", en: "East Wing", sw: "Mrengo wa Mashariki" },
  { slug: "clairmont-side", en: "Clairmont side", sw: "Upande wa Clairmont" },
] as const;
export type SectionSlug = (typeof SECTIONS)[number]["slug"];
export const SECTION_SLUGS = SECTIONS.map((s) => s.slug) as SectionSlug[];
export const sectionLabel = (slug: string | null | undefined) =>
  SECTIONS.find((s) => s.slug === slug)?.en ?? slug ?? "—";

// Default table numbering used when the database has no tables yet.
// CONFIRM with the restaurant: edit from Portal → QR codes once the real plan is known.
export const DEFAULT_TABLES: Record<SectionSlug, string[]> = {
  "bar-side": range(1, 8),
  "west-wing": range(9, 20),
  "east-wing": range(21, 32),
  "clairmont-side": range(33, 40),
};
function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
}

export const OCCASIONS = [
  { key: "dinner", en: "Dinner", sw: "Chakula cha jioni" },
  { key: "lunch", en: "Lunch", sw: "Chakula cha mchana" },
  { key: "date-night", en: "Date night", sw: "Miadi ya kimapenzi" },
  { key: "celebration", en: "Celebration", sw: "Sherehe" },
  { key: "business", en: "Business", sw: "Kikao cha biashara" },
  { key: "family", en: "Family", sw: "Familia" },
  { key: "drinks-lounge", en: "Drinks and lounge", sw: "Vinywaji na mapumziko" },
] as const;
export const occasionLabel = (key: string | null | undefined) =>
  OCCASIONS.find((o) => o.key === key)?.en ?? key ?? "—";

export const CATEGORIES = [
  { key: "food", en: "Food", sw: "Chakula" },
  { key: "service", en: "Service", sw: "Huduma" },
  { key: "ambience", en: "Ambience", sw: "Mandhari" },
  { key: "cleanliness", en: "Cleanliness", sw: "Usafi" },
  { key: "value", en: "Value", sw: "Thamani ya pesa" },
  { key: "drinks", en: "Drinks", sw: "Vinywaji" },
  { key: "speed", en: "Speed of service", sw: "Kasi ya huduma" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as CategoryKey[];

export const RATING_LABELS = {
  en: ["", "Disappointing", "Below expectations", "Good", "Excellent", "Exceptional"],
  sw: ["", "Haikuridhisha", "Chini ya matarajio", "Nzuri", "Bora sana", "Ya kipekee"],
} as const;

export const HIGHLIGHTS = [
  { key: "flavour", en: "Exquisite flavours", sw: "Ladha ya kupendeza" },
  { key: "presentation", en: "Beautiful presentation", sw: "Mpangilio maridadi wa chakula" },
  { key: "warm-service", en: "Warm, attentive service", sw: "Huduma ya ukarimu" },
  { key: "recommendations", en: "Thoughtful recommendations", sw: "Ushauri mzuri wa vyakula" },
  { key: "ambience", en: "Elegant ambience", sw: "Mandhari ya kifahari" },
  { key: "gardens", en: "The gardens and views", sw: "Bustani na mandhari" },
  { key: "cocktails", en: "Cocktails and wine", sw: "Kokteli na mvinyo" },
  { key: "dessert", en: "Desserts", sw: "Vitindamlo" },
  { key: "value", en: "Excellent value", sw: "Thamani nzuri ya pesa" },
  { key: "cleanliness", en: "Spotless setting", sw: "Usafi wa hali ya juu" },
  { key: "pace", en: "Perfectly paced", sw: "Huduma kwa wakati" },
  { key: "occasion", en: "Made our occasion special", sw: "Tukio letu lilipendeza" },
] as const;

export const IMPROVEMENTS = [
  { key: "wait-time", en: "Waiting time", sw: "Muda wa kusubiri" },
  { key: "food-temperature", en: "Food temperature", sw: "Joto la chakula" },
  { key: "seasoning", en: "Seasoning", sw: "Viungo vya chakula" },
  { key: "portions", en: "Portion size", sw: "Kiasi cha chakula" },
  { key: "attentiveness", en: "Staff attentiveness", sw: "Umakini wa wahudumu" },
  { key: "order-accuracy", en: "Order accuracy", sw: "Usahihi wa oda" },
  { key: "billing", en: "Bill and payment", sw: "Bili na malipo" },
  { key: "drinks", en: "Drinks", sw: "Vinywaji" },
  { key: "noise", en: "Noise level", sw: "Kelele" },
  { key: "comfort", en: "Seating comfort", sw: "Starehe ya viti" },
  { key: "cleanliness", en: "Cleanliness", sw: "Usafi" },
  { key: "price", en: "Price", sw: "Bei" },
  { key: "menu-variety", en: "Menu variety", sw: "Aina za vyakula" },
  { key: "parking", en: "Parking and arrival", sw: "Maegesho na mapokezi" },
] as const;

export const highlightLabel = (key: string) => HIGHLIGHTS.find((h) => h.key === key)?.en ?? key;
export const improvementLabel = (key: string) => IMPROVEMENTS.find((h) => h.key === key)?.en ?? key;

// A guest rating of 3 or below is treated as urgent.
export const URGENT_THRESHOLD = 3;

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function feedbackUrl(section?: string, table?: string) {
  const u = new URL("/feedback", appUrl());
  if (section) u.searchParams.set("section", section);
  if (table) u.searchParams.set("table", table);
  return u.toString();
}

export function guestLinks() {
  const review =
    process.env.GOOGLE_REVIEW_URL ||
    // Fallback until the Google Business Profile review link is supplied.
    "https://www.google.com/maps/search/?api=1&query=The+Lord+Erroll+Gourmet+Restaurant+Ruaka+Road+Nairobi";
  return {
    googleReview: review,
    googleReviewIsPlaceholder: !process.env.GOOGLE_REVIEW_URL,
    instagram: process.env.INSTAGRAM_URL || "https://www.instagram.com/lord_erroll/",
    facebook: process.env.FACEBOOK_URL || "",
    tripadvisor: process.env.TRIPADVISOR_URL || "",
  };
}

export const feedbackRef = (n: number) => `LE-${String(n).padStart(4, "0")}`;
