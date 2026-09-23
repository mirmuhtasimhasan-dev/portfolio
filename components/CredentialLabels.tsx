"use client";

import { CREDENTIALS } from "@/lib/content";
import { credentialLabelEls } from "@/lib/labelStore";

/**
 * Labels for the three lit floors of the Credentials building. Rendered once;
 * CredentialsBuilding projects each floor's anchor to the screen every frame
 * and writes position and opacity here.
 */
export function CredentialLabels() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {CREDENTIALS.map((item, i) => (
        <div
          key={item.title}
          ref={(el) => {
            credentialLabelEls[i] = el;
          }}
          className="absolute left-0 top-0 w-max max-w-[18rem] border-l-2 border-green bg-bg-night/90 py-1 pl-3 pr-4 will-change-transform"
          style={{ opacity: 0, visibility: "hidden" }}
        >
          <p className="font-mono text-[11px] tracking-widest text-green">{item.year}</p>
          <p className="text-sm leading-snug text-text">{item.title}</p>
          {item.issuer && <p className="text-xs text-text-2">{item.issuer}</p>}
        </div>
      ))}
    </div>
  );
}
