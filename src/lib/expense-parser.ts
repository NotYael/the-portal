/**
 * Rule-based quick-add parser — the deterministic fallback for
 * POST /api/expenses/parse (docs/PORTAL_SPEC.md → AI features → Parse).
 * Splits on commas and "and", takes the last number in each chunk as the
 * amount, and maps keywords to a category slug (default `other`).
 */
import { addDays } from "./dates";
import type { CategorySlug, ISODate, PaymentMethod } from "./types";

export interface ParsedExpense {
  description: string;
  amount: number;
  category_slug: CategorySlug;
  spent_on: ISODate;
  payment_method: PaymentMethod | null;
}

export interface ParseResult {
  items: ParsedExpense[];
  source: "ai" | "rules";
}

export const MAX_PARSE_LENGTH = 500;

const KEYWORDS: [CategorySlug, RegExp][] = [
  ["transport", /\b(grab|angkas|joyride|jeep(ney)?|mrt|lrt|p2p|bus|taxi|tricycle|trike|pamasahe|gas|gasoline|petrol|parking|toll)\b/i],
  ["living", /\b(rent|upa|meralco|electric(ity)?|kuryente|water|tubig|internet|wifi|pldt|converge)\b/i],
  ["subs", /\b(spotify|netflix|youtube|disney|icloud|hosting|subscription|chatgpt|claude)\b/i],
  ["gifts", /\b(gifts?|regalo|pasalubong)\b/i],
  ["shopping", /\b(shopee|lazada|uniqlo|clothes|shoes|damit|sm store)\b/i],
  ["food", /\b(coffee|kape|lunch|dinner|breakfast|merienda|snacks?|groceries|grocery|puregold|jollibee|mcdo|starbucks|food|meal|kain|pagkain|milk ?tea)\b/i],
  ["leisure", /\b(movies?|cinema|games?|steam|concert|karaoke|bowling|gym)\b/i],
];

const PAYMENT_PATTERNS: [PaymentMethod, RegExp][] = [
  ["gcash", /\b(via |thru |through |using )?g-?cash\b/i],
  ["card", /\b(via |thru |through |using )?(credit |debit )?card\b/i],
  ["bank", /\b(via |thru |through |using )?(bank|bpi|bdo|metrobank|unionbank)( transfer)?\b/i],
  ["cash", /\b(via |thru |through |using )?cash\b/i],
];

const DATE_WORDS: [number, RegExp][] = [
  [-1, /\b(kahapon|yesterday)\b/i],
  [0, /\b(ngayon|today)\b/i],
];

// A comma followed by exactly three digits is a thousands separator ("1,500").
const SPLIT = /\s*(?:,(?!\d{3}(?!\d))|;|\n|\band\b)\s*/i;
const AMOUNT = /(?:₱|php\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(k)?\b/gi;

export function categorize(text: string): CategorySlug {
  for (const [slug, pattern] of KEYWORDS) if (pattern.test(text)) return slug;
  return "other";
}

export function parseExpensesWithRules(text: string, today: ISODate): ParseResult {
  const items: ParsedExpense[] = [];
  for (const raw of text.slice(0, MAX_PARSE_LENGTH).split(SPLIT)) {
    let chunk = raw.trim();
    if (!chunk) continue;

    const matches = [...chunk.matchAll(AMOUNT)];
    const last = matches.at(-1);
    if (!last) continue; // never invent an amount
    const whole = Number(last[1].replace(/,/g, ""));
    const cents = last[2] ? Number(`0.${last[2]}`) : 0;
    const amount = (whole + cents) * (last[3] ? 1000 : 1);
    if (!(amount > 0)) continue;
    chunk = (chunk.slice(0, last.index) + chunk.slice(last.index! + last[0].length)).trim();

    let payment: PaymentMethod | null = null;
    for (const [method, pattern] of PAYMENT_PATTERNS) {
      if (pattern.test(chunk)) {
        payment = method;
        chunk = chunk.replace(pattern, " ");
        break;
      }
    }

    let spentOn = today;
    for (const [offset, pattern] of DATE_WORDS) {
      if (pattern.test(chunk)) {
        spentOn = addDays(today, offset);
        chunk = chunk.replace(pattern, " ");
        break;
      }
    }

    const description = tidy(chunk) || "Expense";
    items.push({
      description,
      amount: Math.round(amount * 100) / 100,
      category_slug: categorize(raw),
      spent_on: spentOn,
      payment_method: payment,
    });
  }
  return { items, source: "rules" };
}

function tidy(text: string): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:@]+|[\s\-–—:@]+$/g, "")
    .replace(/\s+(for|sa|ng|at|-|—)$/i, "")
    .trim()
    .slice(0, 200);
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
