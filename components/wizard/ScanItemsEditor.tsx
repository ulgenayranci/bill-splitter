"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Plus, Lock, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BillPhotoLightbox } from "./BillPhotoLightbox";
import { useBillStore } from "@/stores/useBillStore";
import { TOLERANCE_CENTS } from "@/lib/reconcileScannedBill";
import { formatCents, parseCents, centsToInput, computeSubtotalCents } from "@/lib/billMath";
import { setPendingScanFile } from "@/lib/pendingScan";

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
  const taxCents = useBillStore((s) => s.taxCents);
  const setStep = useBillStore((s) => s.setStep);
  const billImageUrl = useBillStore((s) => s.billImageUrl);
  const [photoOpen, setPhotoOpen] = useState(false);

  // Retake: pick a new photo right here (phones only open the camera from a tap on the
  // visible screen), hand it to the setup screen, which runs the normal scan.
  const retakeInputRef = useRef<HTMLInputElement>(null);
  const [confirmRetake, setConfirmRetake] = useState(false);
  // Items as they were when this screen opened — "edited" = anything changed since.
  const [itemsAtOpen] = useState(() => JSON.stringify(items));

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

  const noTotal = scanCheck != null && targetCents == null;
  const anyFlagged = items.some((i) => i.scanFlag);

  // Read the live draft for a row, defaulting to the item's current store values.
  const draftFor = (item: (typeof items)[number]) =>
    reviewDrafts[item.id] ?? {
      name: item.name,
      price: centsToInput(item.priceCents, currencyCode),
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
    const priceCents = parseCents(draft.price, currencyCode);
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

  const hasEdits = () =>
    Object.keys(reviewDrafts).length > 0 || JSON.stringify(items) !== itemsAtOpen;

  const handleRetakeTap = () => {
    if (hasEdits()) setConfirmRetake(true);
    else retakeInputRef.current?.click();
  };

  const handleRetakeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    setConfirmRetake(false);
    if (!file) return;
    setPendingScanFile(file);
    setStep(1);
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
      <input
        ref={retakeInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleRetakeFile}
        aria-hidden="true"
        tabIndex={-1}
        data-testid="retake-file-input"
      />
      <div className="flex min-h-[44px] w-full items-center gap-3 rounded-md border border-border bg-white px-3 py-2">
        {billImageUrl ? (
          <button
            type="button"
            aria-label="View receipt photo"
            data-testid="scan-review-photo"
            onClick={() => setPhotoOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left text-zinc-900"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={billImageUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-md object-cover"
            />
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">View receipt</span>
              <span className="text-[13px] text-zinc-500">Compare with your items</span>
            </span>
          </button>
        ) : (
          <span className="flex-1 text-[15px] font-semibold text-zinc-900">Receipt</span>
        )}
        <button
          type="button"
          aria-label="Retake photo"
          data-testid="scan-review-retake"
          onClick={handleRetakeTap}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-zinc-700"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>
      {confirmRetake && (
        <Card data-testid="scan-review-retake-confirm" className="flex flex-col gap-3 px-4 py-3">
          <p className="text-[15px] font-semibold text-zinc-900">Retake photo?</p>
          <p className="text-[13px] text-n600">Your edits to the items will be replaced by the new scan.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setConfirmRetake(false)}>
              Cancel
            </Button>
            <Button type="button" className="h-11 flex-1" onClick={() => retakeInputRef.current?.click()}>
              Retake
            </Button>
          </div>
        </Card>
      )}
      <h1 className="text-[18px] font-semibold text-zinc-900">
        {isOff
          ? "Your items don't match the receipt"
          : anyFlagged || noTotal
            ? "Please check these items"
            : "Edit scanned items"}
      </h1>

      {noTotal && (
        <div
          data-testid="scan-review-no-total"
          className="rounded-md border border-border bg-white px-3 py-2"
        >
          <p className="text-[15px] font-semibold text-warn-strong">
            No total found on the receipt — please check the items
          </p>
        </div>
      )}

      {targetCents != null && (
        <div
          data-testid="scan-review-gap"
          className="flex flex-col gap-0.5 rounded-md border border-border bg-white px-3 py-2"
        >
          <p
            data-testid="scan-review-gap-primary"
            className={`text-[16px] font-semibold ${isOff ? "text-warn-strong" : "text-zinc-900"}`}
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
              <Card
                className={`flex flex-col gap-2 px-4 py-3 ${item.scanFlag ? "border-warn ring-[3px] ring-warn-soft" : ""}`}
                aria-describedby={item.scanFlag ? `scan-flag-${item.id}` : undefined}
              >
                {item.scanFlag && (
                  <span
                    id={`scan-flag-${item.id}`}
                    data-testid="scan-line-flag"
                    className="inline-flex items-center gap-1 self-start rounded-full bg-coral-50 px-2 py-0.5 text-[12px] font-semibold text-warn-strong"
                  >
                    <AlertTriangle size={12} aria-hidden="true" />
                    {item.scanFlag}
                  </span>
                )}
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
                    maxLength={12}
                    className="h-10 w-32 bg-white text-base"
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

      {taxCents != null && taxCents > 0 && (
        <div
          data-testid="editor-tax"
          className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2 text-[13px] text-zinc-600"
        >
          <Lock size={14} className="shrink-0 text-zinc-400" aria-hidden="true" />
          <span>
            Tax {formatCents(taxCents, currencyCode)}, split equally and not part of the items total
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
      <BillPhotoLightbox open={photoOpen} onClose={() => setPhotoOpen(false)} />
    </div>
  );
}
