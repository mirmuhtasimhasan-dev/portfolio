import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { projects } from "@/data/projects";

export const metadata: Metadata = {
  title: "All projects · Muhtasim",
  description: "Every project by Mir MD Muhtasim Hasan, full-stack developer in Mohammadpur, Dhaka.",
};

export default function ProjectsPage() {
  const list = [...projects].sort((a, b) => b.year - a.year);
  return (
    <main className="min-h-screen bg-bg-night px-6 pb-24 pt-8 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between py-4">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.3em] text-text transition-colors hover:text-green"
          >
            Muhtasim
          </Link>
          <Link href="/" className="text-sm text-text-2 transition-colors hover:text-text">
            <span aria-hidden>←</span> Back to the city
          </Link>
        </header>

        <div className="mt-12 border-b border-line-base pb-10">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-green">05 / Projects</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-text sm:text-6xl">All projects</h1>
          <p className="mt-4 max-w-xl text-text-2">
            Everything I have built and shipped, newest first.
          </p>
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => (
            <li
              key={p.slug}
              className="group flex flex-col overflow-hidden rounded-md border border-line-base bg-bg-night transition-colors hover:border-green/50"
            >
              <div className="relative aspect-[16/10] overflow-hidden border-b border-line-base">
                <Image
                  src={p.image}
                  alt={`${p.name} home page`}
                  fill
                  loading={i < 3 ? "eager" : "lazy"}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-top opacity-90 transition-opacity group-hover:opacity-100"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-text">{p.name}</h2>
                  <p className="shrink-0 font-mono text-xs text-text-2">
                    {p.year} ·{" "}
                    <span className={p.status === "Live" ? "text-green" : "text-text-2"}>{p.status}</span>
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-text-2">{p.what}</p>
                <ul className="flex flex-wrap gap-1.5" aria-label="Stack">
                  {p.stack.map((t) => (
                    <li key={t} className="rounded-full border border-green/25 px-2.5 py-0.5 text-xs text-text">
                      {t}
                    </li>
                  ))}
                </ul>
                {p.infra && <p className="text-xs leading-relaxed text-text-2">{p.infra}</p>}
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener"
                  className="mt-auto inline-flex items-center gap-1.5 self-start text-sm font-medium text-green transition-colors hover:text-text"
                >
                  Visit site <span aria-hidden>↗</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
