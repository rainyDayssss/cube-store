"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  ChevronLeft,
  Loader2,
  ShieldCheck,
  ShoppingCart,
  X,
} from "lucide-react";
import { cartCount, cartSubtotal, useCartStore, type CartItem } from "@/features/cart/lib/cart";
import { type PaymentMethod } from "@/features/checkout/lib/checkout";
import { submitCheckout, type CheckoutActionResponse } from "@/features/checkout/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "cod", label: "Cash on delivery", hint: "Pay when your order arrives." },
  { value: "ewallet", label: "E-wallet", hint: "GCash, GrabPay, Maya and more." },
  { value: "bank_transfer", label: "Bank transfer", hint: "Manual transfer — details by email." },
];

type FormFields = {
  fullName: string;
  email: string;
  contactNumber: string;
  deliveryAddress: string;
  notes: string;
  paymentMethod: PaymentMethod;
};

const EMPTY_FORM: FormFields = {
  fullName: "",
  email: "",
  contactNumber: "",
  deliveryAddress: "",
  notes: "",
  paymentMethod: "cod",
};

export function CheckoutView() {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const clearCart = useCartStore((state) => state.clearCart);

  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormFields, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckoutActionResponse | null>(null);
  // Snapshot of what was ordered, captured before the cart is cleared.
  const [confirmation, setConfirmation] = useState<{
    orderNumber: string;
    totalAmount: number;
    count: number;
    lines: CartItem[];
  } | null>(null);

  const subtotal = cartSubtotal(items);
  const count = cartCount(items);

  const set = (key: keyof FormFields) => (value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    // Quick client-side pass so the user sees field errors immediately; the
    // server action re-validates everything authoritatively (ADR-0004).
    const errors: Partial<Record<keyof FormFields, string>> = {};
    if (!fields.fullName.trim()) errors.fullName = "Full name is required.";
    if (!EMAIL_RE.test(fields.email.trim())) errors.email = "Enter a valid email address.";
    if (!fields.contactNumber.trim()) errors.contactNumber = "Contact number is required.";
    if (!fields.deliveryAddress.trim()) errors.deliveryAddress = "Delivery address is required.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const lines = items.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
    }));

    setSubmitting(true);
    setResult(null);
    try {
      const response = await submitCheckout({
        details: {
          fullName: fields.fullName.trim(),
          email: fields.email.trim(),
          contactNumber: fields.contactNumber.trim(),
          deliveryAddress: fields.deliveryAddress.trim(),
          paymentMethod: fields.paymentMethod,
          notes: fields.notes.trim() || undefined,
        },
        items: lines,
      });

      if (response.ok) {
        // Copy the array (NOT `{ ...items }` — that yields an object of
        // numeric keys). The snapshot is shown in the confirmation modal
        // after the cart is cleared.
        const snapshot = [...items];
        setConfirmation({
          orderNumber: response.orderNumber,
          totalAmount: response.totalAmount,
          count,
          lines: snapshot,
        });
        clearCart(); // success: the cart is spent
        return;
      }

      if (response.code === "VALIDATION" && response.field) {
        setFieldErrors((prev) => ({ ...prev, [response.field!]: response.message }));
      }
      setResult(response);
    } finally {
      setSubmitting(false);
    }
  }

  // Not hydrated yet: show a skeleton so the badge and totals never flash wrong.
  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="h-96 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10">
      <Link
        href="/cart"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to cart
      </Link>

      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Checkout</h1>

      {/* After a successful order the cart is cleared, so the form gives way
          to the empty state (the confirmation modal stays on top). */}
      {items.length === 0 ? (
        <EmptyCheckout />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Left: guest details form */}
          <form onSubmit={handleSubmit} noValidate className="min-w-0 space-y-6">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Your details
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                No account needed — we only use these to deliver your order
                (guest checkout).
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  label="Full name"
                  htmlFor="checkout-full-name"
                  error={fieldErrors.fullName}
                >
                  <Input
                    id="checkout-full-name"
                    name="fullName"
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    value={fields.fullName}
                    onChange={(e) => set("fullName")(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.fullName)}
                  />
                </Field>
                <Field label="Email" htmlFor="checkout-email" error={fieldErrors.email}>
                  <Input
                    id="checkout-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="ada@example.com"
                    value={fields.email}
                    onChange={(e) => set("email")(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                </Field>
                <Field
                  label="Contact number"
                  htmlFor="checkout-contact"
                  error={fieldErrors.contactNumber}
                >
                  <Input
                    id="checkout-contact"
                    name="contactNumber"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+63 912 345 6789"
                    value={fields.contactNumber}
                    onChange={(e) => set("contactNumber")(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.contactNumber)}
                  />
                </Field>
                <Field
                  className="sm:col-span-2"
                  label="Delivery address"
                  htmlFor="checkout-address"
                  error={fieldErrors.deliveryAddress}
                >
                  <textarea
                    id="checkout-address"
                    name="deliveryAddress"
                    rows={3}
                    autoComplete="street-address"
                    placeholder="Street, barangay, city, province, postal code"
                    value={fields.deliveryAddress}
                    onChange={(e) => set("deliveryAddress")(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.deliveryAddress)}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                </Field>
                <Field
                  className="sm:col-span-2"
                  label="Notes (optional)"
                  htmlFor="checkout-notes"
                >
                  <textarea
                    id="checkout-notes"
                    name="notes"
                    rows={2}
                    placeholder="Delivery instructions, landmark, gate code…"
                    value={fields.notes}
                    onChange={(e) => set("notes")(e.target.value)}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Payment method
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Recorded only — no payment is taken on this site.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Payment method">
                {PAYMENT_OPTIONS.map((option) => {
                  const active = fields.paymentMethod === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors",
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={option.value}
                          checked={active}
                          onChange={() => set("paymentMethod")(option.value)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {option.label}
                      </span>
                      <span className="pl-6 text-xs text-muted-foreground">{option.hint}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            <ErrorBanner result={result} onDismiss={() => setResult(null)} />

            <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Placing order…
                </>
              ) : (
                `Place order · ${priceFormatter.format(subtotal)}`
              )}
            </Button>
          </form>

          {/* Right: order summary */}
          <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Order summary
            </h2>
            <ul className="mt-4 space-y-3">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote images from seed/Storage */}
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    <span className="absolute bottom-0 right-0 rounded-tl-md bg-background/90 px-1 text-[10px] font-semibold tabular-nums">
                      ×{item.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {priceFormatter.format(item.price)} each
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {priceFormatter.format(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Items ({count})</dt>
                <dd className="font-medium tabular-nums">{priceFormatter.format(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-medium">{subtotal >= 50 ? "Free" : "Calculated at checkout"}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{priceFormatter.format(subtotal)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Stock is reserved when you place your order.
            </p>
          </aside>
        </div>
      )}

      {confirmation && (
        <ConfirmationModal
          confirmation={confirmation}
          onClose={() => setConfirmation(null)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ErrorBanner({
  result,
  onDismiss,
}: {
  result: CheckoutActionResponse | null;
  onDismiss: () => void;
}) {
  if (!result || result.ok) return null;

  if (result.code === "INSUFFICIENT_STOCK") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm" role="alert">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-destructive">Not enough stock</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded p-1 text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-2 space-y-1">
          {result.items.map((issue) => (
            <li key={issue.productId} className="text-muted-foreground">
              <span className="font-medium text-foreground">{issue.name}</span> — only{" "}
              {issue.available ?? 0} left, you asked for {issue.requested}.
            </li>
          ))}
        </ul>
        <Link href="/cart" className="mt-3 inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
          Adjust quantities in cart
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm" role="alert">
      <p className="font-medium text-destructive">
        {result.message}
        {result.code === "PRODUCT_UNAVAILABLE" && (
          <span className="mt-1 block font-normal text-muted-foreground">
            A product in your cart was removed or retired. Review your cart and try again.
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-1 text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ConfirmationModal({
  confirmation,
  onClose,
}: {
  confirmation: { orderNumber: string; totalAmount: number; count: number; lines: CartItem[] };
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close confirmation"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/50 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        tabIndex={-1}
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-2xl outline-none"
      >
        <div className="border-b border-border p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-700 dark:text-emerald-400" />
          </div>
          <h2 id="confirmation-title" className="mt-4 text-xl font-bold tracking-tight">
            Order placed!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Thanks — your cubes are on their way to being packed.
          </p>
        </div>

        <div className="p-6">
          <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Order number
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold tracking-tight">
              {confirmation.orderNumber}
            </p>
          </div>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Items</dt>
              <dd className="font-medium tabular-nums">{confirmation.count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-semibold tabular-nums">
                {priceFormatter.format(confirmation.totalAmount)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment</dt>
              <dd className="font-medium">Recorded at checkout</dd>
            </div>
          </dl>

          <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto border-t border-border pt-4">
            {confirmation.lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {line.name}{" "}
                  <span className="text-muted-foreground">× {line.quantity}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {priceFormatter.format(line.price * line.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <Button asChild size="lg" className="mt-6 w-full">
            <Link href="/products">Continue shopping</Link>
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function EmptyCheckout() {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <ShoppingCart className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">Nothing to check out</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Your cart is empty. Add a few cubes from the catalog first.
      </p>
      <Button asChild className="mt-6">
        <Link href="/products">Browse products</Link>
      </Button>
    </div>
  );
}
