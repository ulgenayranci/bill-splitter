/**
 * OCR guardrails: pure sanity checks on a scanned bill plus the single routing
 * decision "should we force the user through the review screen?".
 * No React / store imports on purpose.
 */

/** User-facing reason labels shown on flagged lines in the review screen. */
export const SCAN_FLAG_REASONS = {
  hardToRead: 'Hard to read',
  quantity: 'Unusual quantity',
  price: 'Unusual price',
  nonItem: 'Looks like a total/tax line',
  autoFixed: 'Auto-fixed — please check',
} as const

export type ScanFlagReason = (typeof SCAN_FLAG_REASONS)[keyof typeof SCAN_FLAG_REASONS]

export const MAX_PLAUSIBLE_QUANTITY = 10
export const PRICE_OUTLIER_FACTOR = 10
export const MIN_ITEMS_FOR_PRICE_CHECK = 3

export interface ScanSanityLine {
  name: string
  quantity: number
  /** LINE TOTAL in cents. */
  priceCents: number
  unitPriceCents?: number
  confidence?: 'high' | 'low' | 'ambiguous'
  /** True when the app changed this line's figures itself. */
  autoFixed?: boolean
}

// Intentionally conservative: whole words only (letter/digit lookarounds), so real
// dishes like "Tipsy cocktail" or "Cardamom tea" are never flagged.
const NON_ITEM_KEYWORDS = [
  'total', 'subtotal', 'sub total', 'sub-total', 'grand total', 'tax', 'taxes', 'vat', 'kdv',
  'tip', 'tips', 'gratuity', 'service', 'service charge', 'servis', 'discount', 'indirim',
  'change', 'cash', 'nakit', 'card', 'kart', 'kredi', 'credit', 'debit', 'balance',
  'amount due', 'toplam', 'ara toplam', 'tutar', 'mwst', 'ust', 'tva', 'iva', 'rabatt',
  'sconto', 'trinkgeld', 'mancia', 'propina', 'pourboire', 'coperto',
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const NON_ITEM_RE = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:' +
    NON_ITEM_KEYWORDS.map((k) =>
      k
        .split(/[\s-]+/)
        .map(escapeRegex)
        .join('[\\s-]+'),
    ).join('|') +
    ')(?![\\p{L}\\p{N}])',
  'iu',
)

function unitPrice(l: ScanSanityLine): number {
  if (l.unitPriceCents != null) return l.unitPriceCents
  return Math.round(l.priceCents / Math.max(1, l.quantity))
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

export function flagScannedLines(lines: ScanSanityLine[]): {
  lineFlags: (ScanFlagReason | null)[]
  flaggedCount: number
  emptyList: boolean
} {
  if (lines.length === 0) return { lineFlags: [], flaggedCount: 0, emptyList: true }

  const units = lines.map(unitPrice)
  const med = lines.length >= MIN_ITEMS_FOR_PRICE_CHECK ? median(units) : 0

  const lineFlags = lines.map((l, idx): ScanFlagReason | null => {
    if (NON_ITEM_RE.test(l.name)) return SCAN_FLAG_REASONS.nonItem
    if (l.autoFixed) return SCAN_FLAG_REASONS.autoFixed
    if (l.quantity > MAX_PLAUSIBLE_QUANTITY) return SCAN_FLAG_REASONS.quantity
    if (med > 0 && units[idx] > PRICE_OUTLIER_FACTOR * med) return SCAN_FLAG_REASONS.price
    if (l.confidence === 'low' || l.confidence === 'ambiguous') return SCAN_FLAG_REASONS.hardToRead
    return null
  })

  return {
    lineFlags,
    flaggedCount: lineFlags.filter((f) => f !== null).length,
    emptyList: false,
  }
}

export type ScanReviewCause = 'no-items' | 'mismatch' | 'no-total' | 'flagged-lines'

export function shouldForceScanReview(input: {
  itemCount: number
  mismatch: boolean
  targetCents: number | null
  flaggedCount: number
}): { forceReview: boolean; reasons: ScanReviewCause[] } {
  const reasons: ScanReviewCause[] = []
  if (input.itemCount === 0) reasons.push('no-items')
  if (input.mismatch) reasons.push('mismatch')
  if (input.targetCents == null) reasons.push('no-total')
  if (input.flaggedCount > 0) reasons.push('flagged-lines')
  return { forceReview: reasons.length > 0, reasons }
}
