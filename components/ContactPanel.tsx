"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CONTACT } from "@/lib/content";

const field =
  "w-full rounded-md border border-line-base bg-bg-night/70 px-3.5 py-2.5 text-sm text-text placeholder:text-text-2/60 outline-none transition-colors focus:border-green";

/** Contact details and form UI. The form does not send anything yet. */
export function ContactPanel({ eyebrow }: { eyebrow: ReactNode }) {
  const [note, setNote] = useState("");

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNote(`Sending isn't connected yet. Email ${CONTACT.email} for now.`);
  };

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-14">
      <div>
        {eyebrow}
        <h2 className="text-4xl font-semibold tracking-tight text-text sm:text-6xl">Say hello</h2>
        <dl className="mt-8 space-y-4 text-sm">
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-widest text-text-2">Email</dt>
            <dd>
              <a href={`mailto:${CONTACT.email}`} className="text-text hover:text-green">
                {CONTACT.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-widest text-text-2">Phone</dt>
            <dd>
              <a href={CONTACT.phoneHref} className="text-text hover:text-green">
                {CONTACT.phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-widest text-text-2">GitHub</dt>
            <dd>
              <a href={CONTACT.githubHref} target="_blank" rel="noopener" className="text-text hover:text-green">
                {CONTACT.github}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-widest text-text-2">Location</dt>
            <dd className="text-text">
              {CONTACT.location} <span className="text-text-2">· {CONTACT.timezone}</span>
            </dd>
          </div>
        </dl>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="contact-name" className="mb-1.5 block text-xs text-text-2">
            Name
          </label>
          <input id="contact-name" name="name" required autoComplete="name" className={field} />
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1.5 block text-xs text-text-2">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="mb-1.5 block text-xs text-text-2">
            Message
          </label>
          <textarea id="contact-message" name="message" required rows={5} className={`${field} resize-none`} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="rounded-full bg-green px-6 py-3 text-sm font-semibold text-bg-night transition-colors hover:bg-text focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green"
          >
            Send message
          </button>
          <p role="status" aria-live="polite" className="text-xs text-text-2">
            {note}
          </p>
        </div>
      </form>
    </div>
  );
}
