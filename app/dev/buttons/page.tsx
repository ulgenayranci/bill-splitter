'use client'

// Dev-only gallery of every button style in the app, for design review.
// Shared <Button> examples use the real component, so edits to
// components/ui/button.tsx show up here. Custom <button> examples copy the
// className from their source file — change both when restyling one.

import type { ReactNode } from 'react'
import {
  Camera, Check, Copy, LoaderCircle, Minus, Pencil, Plus, RotateCcw, Share2, Trash2, X, XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.07em] text-zinc-500">{title}</h2>
        {note && <p className="mt-1 text-[12px] text-zinc-400">{note}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Sample({ id, name, where, dark, children }: {
  id: string; name: string; where: string; dark?: boolean; children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">{id}</span>
        <span className="text-[14px] font-medium text-zinc-900">{name}</span>
      </div>
      <div className={`relative flex flex-wrap items-center gap-2 rounded-lg p-3 ${dark ? 'bg-zinc-800' : 'bg-background'}`}>
        {children}
      </div>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-zinc-400">{where}</p>
    </div>
  )
}

export default function ButtonGalleryPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-8 bg-zinc-50 px-4 py-6">
      <header>
        <h1 className="text-[22px] font-semibold text-zinc-900">Button styles</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Every button in the app, grouped. Refer to them by their tag (e.g. B3).</p>
      </header>

      <Section title="Shared button — base variants" note="components/ui/button.tsx. Changing these changes every screen that uses them.">
        <Sample id="A1" name="default" where="variant=&quot;default&quot;">
          <Button>Default</Button>
          <Button disabled>Disabled</Button>
        </Sample>
        <Sample id="A1w" name="warning (coral)" where="variant=&quot;warning&quot; — warning confirms only">
          <Button variant="warning">Warning</Button>
          <Button variant="warning" disabled>Disabled</Button>
        </Sample>
        <Sample id="A2" name="outline" where="variant=&quot;outline&quot;">
          <Button variant="outline">Outline</Button>
          <Button variant="outline" disabled>Disabled</Button>
        </Sample>
        <Sample id="A4" name="ghost" where="variant=&quot;ghost&quot; (dialog close ✕ only)">
          <Button variant="ghost">Ghost</Button>
        </Sample>
        <Sample id="A6" name="link" where="variant=&quot;link&quot; (not used yet)">
          <Button variant="link">Link</Button>
        </Sample>
        <Sample id="A7" name="sizes" where="size= xs / sm / default / lg">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button>default</Button>
          <Button size="lg">lg</Button>
        </Sample>
        <Sample id="A8" name="icon sizes" where="size= icon-xs / icon-sm / icon / icon-lg">
          <Button variant="outline" size="icon-xs"><Plus /></Button>
          <Button variant="outline" size="icon-sm"><Plus /></Button>
          <Button variant="outline" size="icon"><Plus /></Button>
          <Button variant="outline" size="icon-lg"><Plus /></Button>
        </Sample>
      </Section>

      <Section title="Shared button — as used in screens">
        <Sample id="B1" name="Primary full-width (stone) + loading state" where="Second button = loading state: shown while the app is working, e.g. after tapping Continue (SetupStep) or Confirm tip (TipScreen). Used by SetupStep Continue · TipScreen Confirm · CollaborativeClaimingView I'm done · PersonSlotPicker Add me">
          <Button className="h-12 w-full text-base">Continue</Button>
          <Button className="h-12 w-full" disabled><LoaderCircle size={16} className="animate-spin" /></Button>
        </Sample>
        <Sample id="B2" name="Primary full-width" where="ScanItemsEditor Done">
          <Button className="h-12 w-full text-base">Done</Button>
        </Sample>
        <Sample id="B3" name="Paired bottom actions" where="InvitePeopleStep Skip/Share · CollaborativeClaimingView warning Share/Show my result">
          <div className="flex w-full gap-2">
            <Button variant="outline" className="h-12 flex-1">Skip</Button>
            <Button className="h-12 flex-1"><Share2 size={18} className="mr-2" />Share link</Button>
          </div>
        </Sample>
        <Sample id="B4" name="Paired results actions" where="PersonResultsScreen Go back / Share summary">
          <div className="flex w-full gap-2">
            <Button variant="outline" className="h-12 flex-1">Go back</Button>
            <Button className="h-12 flex-1"><Copy size={16} className="mr-2" />Share summary</Button>
          </div>
        </Sample>
        <Sample id="B4w" name="Warning confirm (coral)" where="AppHeader New Split confirm">
          <Button variant="warning" className="h-12 w-full">New Split</Button>
        </Sample>
        <Sample id="B5" name="Full-width outline" where="PersonResultsScreen confirm Cancel">
          <Button variant="outline" className="h-12 w-full">Cancel</Button>
        </Sample>
        <Sample id="B6" name="Tip presets" where="TipScreen 10% / 15% / 20%">
          <div className="flex w-full gap-2">
            <Button variant="outline" className="h-11 flex-1">10%</Button>
            <Button variant="outline" className="h-11 flex-1">15%</Button>
            <Button variant="outline" className="h-11 flex-1">20%</Button>
          </div>
        </Sample>
        <Sample id="B7" name="Quantity stepper" where="ClaimableItemCard − / +">
          <Button variant="outline" size="icon" className="h-11 w-11" disabled><Minus size={16} /></Button>
          <span className="min-w-[2ch] text-center text-[16px] font-semibold">1</span>
          <Button variant="outline" size="icon" className="h-11 w-11"><Plus size={16} /></Button>
        </Sample>
        <Sample id="B8" name="Small outline with icon" where="SetupStep Retake / Edit">
          <Button variant="outline"><RotateCcw size={13} />Retake</Button>
          <Button variant="outline"><Pencil size={13} />Edit</Button>
        </Sample>
        <Sample id="B9" name="Paired form actions" where="PersonSlotPicker rename Cancel / Save · item form footer Delete / Cancel / Save">
          <div className="flex w-full gap-2">
            <Button variant="outline" className="h-11 flex-1 text-[14px]">Cancel</Button>
            <Button className="h-11 flex-1 text-[14px]">Save</Button>
          </div>
          <div className="flex w-full items-center gap-2 border-t border-border pt-3">
            <button type="button" className="flex h-11 items-center gap-1.5 rounded-md border border-danger/30 bg-white px-3 text-[14px] font-medium text-danger"><Trash2 size={16} />Delete</button>
            <Button variant="outline" className="ml-auto h-11 px-4">Cancel</Button>
            <Button className="h-11 px-5">Save</Button>
          </div>
        </Sample>
        <Sample id="B10" name="Dialog confirm" where="AppHeader New Split confirm Cancel / New Split">
          <Button variant="outline">Cancel</Button>
          <Button variant="warning">New Split</Button>
        </Sample>
        <Sample id="B11" name="Dialog close (X)" where="components/ui/dialog.tsx">
          <Button variant="ghost" size="icon-sm"><XIcon /></Button>
        </Sample>
      </Section>

      <Section title="Custom buttons" note="Hand-styled <button>s, not the shared component. Each one is styled separately in its file.">
        <Sample id="C1" name="Header Invite (coral pill)" where="BillViewHeader">
          <button type="button" className="flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-coral-500 px-3 text-white transition-colors">
            <Share2 size={18} /><span className="text-[13px] font-medium whitespace-nowrap">Invite</span>
          </button>
        </Sample>
        <Sample id="C2" name="Header menu (+ circle)" where="AppHeader">
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-coral-500 text-white transition-colors">
            <Plus size={22} />
          </button>
        </Sample>
        <Sample id="C3" name="Menu items" where="AppHeader dropdown">
          <div className="w-48 rounded-lg border border-zinc-200 bg-white py-1">
            <button type="button" className="flex w-full items-center px-4 py-2.5 text-left text-[14px] font-medium text-zinc-900">New Split</button>
            <button type="button" className="flex w-full cursor-not-allowed items-center px-4 py-2.5 text-left text-[14px] font-medium text-zinc-300">Disabled item</button>
          </div>
        </Sample>
        <Sample id="C4" name="Scan receipt tile" where="SetupStep (normal + error)">
          {[false, true].map((err) => (
            <button key={String(err)} type="button" className={`flex w-full flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed px-5 py-7 text-center transition-colors ${err ? 'border-red-300 bg-red-50' : 'border-zinc-300 bg-white'}`}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-50">
                <Camera size={26} className="text-coral-600" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[16px] font-semibold text-zinc-900">Scan your receipt</span>
                <span className="text-[13px] text-zinc-400">{err ? 'Something went wrong — tap to try again' : 'Take a photo of the receipt and I will capture all the items for you.'}</span>
              </div>
            </button>
          ))}
        </Sample>
        <Sample id="C5" name="Add person (+ inside input)" where="SetupStep (active / empty)">
          {[true, false].map((active) => (
            <div key={String(active)} className="relative h-11 w-full rounded-md border border-border bg-white">
              <button type="button" className={`absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors ${active ? 'bg-stone text-white' : 'text-zinc-400'}`}>
                <Plus size={18} />
              </button>
            </div>
          ))}
        </Sample>
        <Sample id="C6" name="Square icon buttons (white, bordered)" where="ScanItemsEditor trash (h-10) · SetupStep remove person (h-9) · PersonSlotPicker rename (h-11)">
          <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-white text-zinc-400"><Trash2 size={16} /></button>
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-zinc-400"><Trash2 size={16} /></button>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-white text-zinc-500"><Pencil size={16} /></button>
        </Sample>
        <Sample id="C7" name="Item edit pencil (tall)" where="CollaborativeClaimingView item row">
          <button type="button" className="flex h-[50px] w-11 shrink-0 items-center justify-center self-start rounded-md border border-border bg-card text-zinc-500"><Pencil size={16} /></button>
        </Sample>
        <Sample id="C8" name="Add item (dashed, full-width)" where="CollaborativeClaimingView">
          <button type="button" className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card text-[14px] text-zinc-600"><Plus size={16} /> Add item</button>
        </Sample>
        <Sample id="C9" name="Text links" where="ScanItemsEditor Add item · PersonSlotPicker I'm not listed · CollaborativeClaimingView Continue editing · Delete">
          <button type="button" className="flex items-center gap-1.5 self-start rounded-md text-[13px] font-semibold text-coral-600"><Plus size={15} />Add item</button>
          <button type="button" className="text-[14px] text-coral-600 underline self-start">I&apos;m not listed</button>
          <button type="button" className="text-[15px] font-medium text-zinc-500 underline-offset-4">Continue editing</button>
          <button type="button" className="flex h-11 items-center gap-1.5 self-start rounded-md border border-danger/30 bg-white px-3 text-[14px] font-medium text-danger"><Trash2 size={16} />Delete</button>
        </Sample>
        <Sample id="C10" name="Dismiss (small X)" where="SetupStep expired-session notice">
          <button type="button" className="shrink-0 text-warn-strong"><X size={16} /></button>
        </Sample>
        <Sample id="C11" name="Photo lightbox close" where="BillPhotoLightbox" dark>
          <div className="h-16 w-full" />
          <button type="button" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-coral-500"><X size={20} /></button>
        </Sample>
      </Section>
    </main>
  )
}
