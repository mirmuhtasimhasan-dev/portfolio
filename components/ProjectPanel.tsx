"use client";

import { useEffect, useSyncExternalStore } from "react";
import { projects } from "@/data/projects";
import { projectStore } from "@/lib/projectStore";

/** Detail panel for a clicked billboard: what, stack, infra and link. */
export function ProjectPanel() {
  const slug = useSyncExternalStore(projectStore.subscribe, projectStore.getOpen, () => null);
  const project = projects.find((p) => p.slug === slug);

  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") projectStore.setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project]);

  if (!project) return null;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="project-panel-title"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col overflow-y-auto border-l border-green/25 bg-bg-night/95 backdrop-blur"
    >
      <div className="flex items-center justify-between border-b border-green/15 px-6 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-green">Project</p>
        <button
          type="button"
          onClick={() => projectStore.setOpen(null)}
          aria-label="Close project details"
          className="rounded p-1 text-text-2 transition-colors hover:text-text"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={project.image} alt={`${project.name} home page`} className="aspect-[16/10] w-full object-cover object-top" />
      <div className="space-y-6 px-6 py-6">
        <div>
          <h2 id="project-panel-title" className="text-3xl font-semibold tracking-tight text-text">
            {project.name}
          </h2>
          <p className="mt-1 font-mono text-xs text-text-2">
            {project.year} ·{" "}
            <span className={project.status === "Live" ? "text-green" : "text-text-2"}>{project.status}</span>
          </p>
        </div>
        <section>
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-text-2">What</h3>
          <p className="mt-1.5 text-base leading-relaxed text-text">{project.what}</p>
        </section>
        <section>
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-text-2">Stack</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {project.stack.map((t) => (
              <li key={t} className="rounded-full border border-green/30 px-2.5 py-0.5 text-xs text-text">
                {t}
              </li>
            ))}
          </ul>
        </section>
        {project.infra && (
          <section>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-text-2">Infra</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text">{project.infra}</p>
          </section>
        )}
        <a
          href={project.url}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-full bg-green px-5 py-2.5 text-sm font-semibold text-bg-night transition-colors hover:bg-text"
        >
          Visit site <span aria-hidden>↗</span>
        </a>
      </div>
    </aside>
  );
}
