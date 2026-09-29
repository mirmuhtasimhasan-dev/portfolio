"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CONTACT } from "@/lib/content";

const field =
  "w-full rounded-md border border-green/40 bg-bg-night px-3.5 py-2.5 text-sm text-text placeholder:text-text-2/80 outline-none transition-colors focus:border-green";
const label = "mb-1.5 block font-mono text-[11px] uppercase tracking-widest text-text-2";

const WEB3FORMS_URL = "https://api.web3forms.com/submit";
const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
const THANKS = "Thanks, I will reply soon.";

type Status = { state: "idle" | "sending" | "sent" | "error"; note: string };

/**
 * Contact details and form in one clean card: info on the left, form on the
 * right (stacked on phone). The form posts to Web3Forms (access key from
 * NEXT_PUBLIC_WEB3FORMS_KEY) and shows sending, success and error states in
 * the card. A hidden "botcheck" checkbox is the honeypot: people never see it,
 * bots tick it, and those submissions are dropped.
 */
export function ContactPanel({ eyebrow }: { eyebrow: ReactNode }) {
  const [status, setStatus] = useState<Status>({ state: "idle", note: "" });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status.state === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    // A bot filled the hidden field: look successful, send nothing.
    if (data.get("botcheck")) {
      setStatus({ state: "sent", note: THANKS });
      return;
    }
    if (!ACCESS_KEY) {
      setStatus({ state: "error", note: `Sending isn't set up yet. Email ${CONTACT.email} instead.` });
      return;
    }
    setStatus({ state: "sending", note: "" });
    try {
      const name = String(data.get("name") ?? "").trim();
      const res = await fetch(WEB3FORMS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `Portfolio message from ${name || "someone"}`,
          from_name: "Muhtasim portfolio",
          name,
          email: data.get("email"),
          message: data.get("message"),
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
      if (!res.ok || !json?.success) throw new Error("send failed");
      form.reset();
      setStatus({ state: "sent", note: THANKS });
    } catch {
      setStatus({ state: "error", note: `Couldn't send that. Try again, or email ${CONTACT.email}.` });
    }
  };
  const sending = status.state === "sending";

  return (
    <div className="grid gap-4 rounded-xl border border-green/30 bg-bg-night/85 p-4 sm:p-7 md:grid-cols-[1fr_1.35fr] md:gap-10">
      <div>
        {eyebrow}
        <h2 className="text-2xl font-semibold tracking-tight text-text sm:text-4xl">Say hello</h2>
        <dl className="mt-3 space-y-1.5 text-sm sm:mt-5 sm:space-y-2.5">
          <div>
            <dt className="sr-only">Email</dt>
            <dd>
              <a href={`mailto:${CONTACT.email}`} className="text-text hover:text-green">
                {CONTACT.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Phone</dt>
            <dd>
              <a href={CONTACT.phoneHref} className="text-text hover:text-green">
                {CONTACT.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="sr-only">GitHub</dt>
            <dd>
              <a href={CONTACT.githubHref} target="_blank" rel="noopener" className="text-text hover:text-green">
                {CONTACT.github}
              </a>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Location</dt>
            <dd className="text-text-2">
              {CONTACT.location} · {CONTACT.timezone}
            </dd>
          </div>
        </dl>
      </div>

      <form onSubmit={onSubmit} className="space-y-2.5 sm:space-y-3" aria-busy={sending}>
        {/* Honeypot: hidden from people and screen readers; bots tick it. */}
        <input type="checkbox" name="botcheck" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div>
            <label htmlFor="contact-name" className={label}>
              Name
            </label>
            <input id="contact-name" name="name" required autoComplete="name" placeholder="Your name" className={field} />
          </div>
          <div>
            <label htmlFor="contact-email" className={label}>
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={field}
            />
          </div>
        </div>
        <div>
          <label htmlFor="contact-message" className={label}>
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={2}
            placeholder="A project, a question, or just hello"
            className={`${field} resize-none`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-green px-6 py-2.5 text-sm font-semibold text-bg-night transition-colors hover:bg-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green disabled:cursor-wait disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send message"}
          </button>
          <p
            role="status"
            aria-live="polite"
            className={`text-xs ${status.state === "sent" ? "text-green" : status.state === "error" ? "text-red" : "text-text-2"}`}
          >
            {status.note}
          </p>
        </div>
      </form>
    </div>
  );
}
