"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useBillStore } from "@/stores/useBillStore";
import { TOLERANCE_CENTS } from "@/lib/reconcileScannedBill";
import { formatCents, parseCents, computeSubtotalCents } from "@/lib/billMath";

/**
 * Edit-scanned-items screen (store step 2). Counts as the Setup step in the
 * progress strip. Holds the per-item editing that used to live in SetupStep's
 * yellow review list. Opens with a problem-stating heading and a total-check
 * summary card (derived from the live gap) above the item list. Each item is
 * shown in its own card. Exits via a
 * single "Done" button back to setup (step 1).
 */
export function ScanItemsEditor() {
  const items = useBillStore((s) => s.items);
  const addItem = useBillStore((s) => s.addItem);
  const updateItem = useBillStore((s) => s.updateItem);
  const removeItem = useBillStore((s) => s.removeItem);
  const currencyCode = useBillStore((s) => s.currencyCode);
  const scanCheck = useBillStore((s) => s.scanCheck);
  const serviceFeeCents = useBillStore((s) => s.serviceFeeCents);
  const setStep = useBillStore((s) => s.setStep);

  // Per-row edit drafts keyed by item id. Holds raw strings so the user can type
  // freely; committed to the store on blur/Enter.
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { name: string; price: string; qty: string }>
  >({});

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.scrollTo === "function"
    ) {
      try {
        window.scrollTo(0, 0);
      } catch {
        // jsdom "not implemented" - ignore
      }
    }
  }, []);

  // Live items sum recomputed from the store so the gap updates as the user edits.
  const liveSumCents = computeSubtotalCents(items);
  const targetCents = scanCheck?.targetCents ?? null;
  const liveDeltaCents = targetCents != null ? targetCents - liveSumCents : 0;
  const isOff =
    targetCents != null && Math.abs(liveDeltaCents) > TOLERANCE_CENTS;

  // Read the live draft for a row, defaulting to the item's current store values.
  const draftFor = (item: (typeof items)[number]) =>
    reviewDrafts[item.id] ?? {
      name: item.name,
      price: (item.priceCents / 100).toFixed(2),
      qty: String(item.quantity ?? 1),
    };

  const setDraft = (
    id: string,
    patch: Partial<{ name: string; price: string; qty: string }>,
  ) =>
    setReviewDrafts((d) => ({
      ...d,
      [id]: {
        ...draftFor(items.find((i) => i.id === id)!),
        ...d[id],
        ...patch,
      },
    }));

  // Commit a row's draft to the store via updateItem. priceCents is the LINE TOTAL.
  // Invalid price/qty are ignored (kept as draft) so we never silently fudge a value.
  const commitRow = (item: (typeof items)[number]) => {
    const draft = reviewDrafts[item.id];
    if (!draft) return;
    const trimmedName = draft.name.trim() || item.name;
    const priceCents = parseCents(draft.price);
    const qty = Number.parseInt(draft.qty, 10);
    const nextQty =
      Number.isInteger(qty) && qty > 0 ? qty : (item.quantity ?? 1);
    if (priceCents == null) return; // invalid price - leave the draft, don't write
    updateItem(item.id, trimmedName, priceCents, nextQty);
    setReviewDrafts((d) => {
      const { [item.id]: _drop, ...rest } = d;
      return rest;
    });
  };

  const handleAddReviewItem = () => {
    // Seed a new line at a placeholder price so the user immediately edits it. We
    // never invent a real amount - 1 cent is the minimal non-zero parseCents allows.
    addItem("New item", 1, 1);
  };

  const handleDone = () => {
    // Commit any pending un-blurred drafts before leaving.
    for (const item of items) {
      if (reviewDrafts[item.id]) commitRow(item);
    }
    setStep(1);
  };

  return (
    <div
      role="region"
      aria-label="Edit scanned items"
      data-testid="scan-items-editor"
      className="flex flex-1 flex-col gap-5"
    >
      <h1 className="text-[18px] font-semibold text-zinc-900">
        {isOff ? "Your items don't match the receipt" : "Edit scanned items"}
      </h1>

      {targetCents != null && (
        <div
          data-testid="scan-review-gap"
          className="flex flex-col gap-0.5 rounded-md border border-border bg-white px-3 py-2"
        >
          <p
            data-testid="scan-review-gap-primary"
            className={`text-[16px] font-semibold ${isOff ? "text-warn" : "text-zinc-900"}`}
          >
            {isOff
              ? `Off by ${formatCents(Math.abs(liveDeltaCents), currencyCode)}`
              : "Matches the receipt"}
          </p>
          <p
            data-testid="scan-review-gap-detail"
            className="text-[13px] text-zinc-500"
          >
            Receipt {scanCheck?.hasSubtotal ? "subtotal" : "total"}{" "}
            {formatCents(targetCents, currencyCode)} · Your items{" "}
            {formatCents(liveSumCents, currencyCode)}
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const draft = draftFor(item);
          return (
            <li key={item.id}>
              <Card className="flex flex-col gap-2 px-4 py-3">
                <Input
                  aria-label="Item name"
                  value={draft.name}
                  onChange={(e) => setDraft(item.id, { name: e.target.value })}
                  onBlur={() => commitRow(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRow(item);
                  }}
                  maxLength={100}
                  className="h-10 w-full bg-white text-base"
                />
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Price"
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) =>
                      setDraft(item.id, { price: e.target.value })
                    }
                    onBlur={() => commitRow(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRow(item);
                    }}
                    maxLength={9}
                    className="h-10 w-20 bg-white text-base"
                  />
                  <Input
                    aria-label="Quantity"
                    inputMode="numeric"
                    value={draft.qty}
                    onChange={(e) => setDraft(item.id, { qty: e.target.value })}
                    onBlur={() => commitRow(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRow(item);
                    }}
                    maxLength={2}
                    className="h-10 w-12 bg-white text-center text-base"
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => removeItem(item.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-white text-zinc-400"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {/* Read-only: the service fee is split equally and is NOT part of the items sum. */}
      {serviceFeeCents != null && serviceFeeCents > 0 && (
        <div
          data-testid="editor-service-fee"
          className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-600"
        >
          <Lock size={14} className="shrink-0 text-zinc-400" aria-hidden="true" />
          <span>
            Service fee {formatCents(serviceFeeCents, currencyCode)}, split equally and not part of the items total
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={handleAddReviewItem}
        className="flex items-center gap-1.5 self-start rounded-md text-[13px] font-semibold text-coral-600"
      >
        <Plus size={15} aria-hidden="true" />
        Add item
      </button>

      <div
        className="mt-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <Button onClick={handleDone} className="h-12 w-full text-base">
          Done
        </Button>
      </div>
    </div>
  );
}
