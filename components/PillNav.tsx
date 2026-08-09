"use client";

import { content } from "@/lib/content";
import { useActiveSection } from "@/lib/useActiveSection";

/**
 * The floating pill navbar. Rendered twice — once in the hero, once over
 * the device's top edge in §5. The second copy is decorative: it repeats
 * links that are already in the tab order, so it is hidden from assistive
 * tech and taken out of it.
 */
export default function PillNav({ decorative = false }: { decorative?: boolean }) {
  const active = useActiveSection();

  return (
    <nav
      className="nav"
      aria-label={decorative ? undefined : "Primary"}
      aria-hidden={decorative || undefined}
    >
      <ul className="nav-pill">
        {content.nav.map((link) => (
          <li key={link.id}>
            <a
              className="nav-link"
              href={`#${link.id}`}
              aria-current={active === link.id ? "true" : undefined}
              tabIndex={decorative ? -1 : undefined}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}