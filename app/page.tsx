import { Fragment } from "react";
import { content } from "@/lib/content";
import PillNav from "@/components/PillNav";
import DeviceTile from "@/components/DeviceTile";

const { identity, hero, about, experience, projects, contact } = content;

export default function Page() {
  return (
    <main id="main" className="page">
      {/* ── 1 · Hero ─────────────────────────────────────────────
          No card behind it — a paper wash only, so the copy stays on
          --ink and --ink-dim over every stop the field can produce. */}
      <section id="home" className="hero">
        <div className="hero-nav">
          <PillNav />
        </div>

        <p className="badge mono">
          <span className="badge-dot" aria-hidden="true" />
          {identity.availability}
        </p>

        <h1 className="hero-name">{identity.greeting}</h1>

        <p className="hero-sub">
          {identity.headline} {identity.sub}
        </p>

        <div className="hero-actions">
          <a className="btn btn-fill" href={hero.primaryCta.href}>
            {hero.primaryCta.label}
            <span className="btn-arrow" aria-hidden="true">
              ↓
            </span>
          </a>
          <a className="btn btn-outline" href={hero.secondaryCta.href}>
            {hero.secondaryCta.label}
          </a>
        </div>

        <p className="hero-meta mono">
          <span>{identity.role}</span>
          <span aria-hidden="true">·</span>
          <span>{identity.location}</span>
        </p>
      </section>

      {/* ── 2 · About ──────────────────────────────────────────── */}
      <section id="about">
        <DeviceTile shot={about.shot} nav />

        {/* The device's screen carries this copy as pixels. Above 900px it is
            large enough to read in there, so the DOM copy steps out of view
            while staying in the HTML and in the accessibility tree — a picture
            of words is not words. Below 900px the device is far too small for
            the text to be legible, so it stays on screen as a normal panel.
            The switch is pure CSS, so nothing moves after paint and nothing
            depends on a script having run. */}
        <div className="about-readable">
          <div className="shell">
            <div className="panel">
              <div className="section-head">
                <p className="eyebrow">{about.eyebrow}</p>
              </div>

              <div className="about-grid">
                <div className="about-copy">
                  <h2 className="h2 about-quote">{about.heading}</h2>
                </div>

                <div className="about-copy">
                  {about.body.map((paragraph) => (
                    <p className="prose" key={paragraph.slice(0, 24)}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 · Experience ─────────────────────────────────────── */}
      <section id="experience" className="section">
        <div className="shell">
          <div className="panel">
            <div className="section-head">
              <p className="eyebrow">{experience.eyebrow}</p>
              <h2 className="h2">{experience.heading}</h2>
            </div>

            <ul className="timeline">
              {experience.credentials.map((c) => (
                <li className="timeline-item" key={c.title}>
                  <h3 className="timeline-title">{c.title}</h3>
                  <p className="timeline-year mono">{c.year}</p>
                  {c.issuer ? (
                    <p className="timeline-issuer">{c.issuer}</p>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="toolset">
              <p className="eyebrow">{experience.toolsetEyebrow}</p>
              <ul className="chips">
                {experience.toolset.map((tool) => (
                  <li className="chip mono" key={tool}>
                    {tool}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 · Projects ─────────────────────────────────────────
          One device tile per project, in the same motion as About: the
          screen carries a real capture of the live site, and the copy —
          which the screenshot does not contain — follows it as a panel. */}
      <section id="projects">
        <div className="section on-field">
          <div className="shell">
            <div className="section-head">
              <p className="eyebrow">{projects.eyebrow}</p>
              <h2 className="h2">{projects.heading}</h2>
            </div>
          </div>
        </div>

        {projects.items.map((project) => (
          <Fragment key={project.index}>
            <DeviceTile shot={project.shot} />

            <div className="section on-field">
              <div className="shell">
                <div className="specsheet">
                  <div className="spec-head">
                    <h3 className="spec-name">{project.name}</h3>
                    <p className="spec-index mono">
                      <span>{project.index}</span>
                      <span aria-hidden="true">·</span>
                      <span>{project.year}</span>
                    </p>
                  </div>

                  <dl className="spec-rows">
                    <div className="spec-row">
                      <dt className="spec-label mono">Status</dt>
                      <dd className="spec-value">
                        <span className="project-status">{project.status}</span>
                      </dd>
                    </div>
                    {project.specs.map((spec) => (
                      <div className="spec-row" key={spec.label}>
                        <dt className="spec-label mono">{spec.label}</dt>
                        <dd className="spec-value">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <a
                    className="project-link mono"
                    href={project.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <span aria-hidden="true">→</span>
                    Visit {project.name}
                  </a>
                </div>
              </div>
            </div>
          </Fragment>
        ))}
      </section>

      {/* ── 5 · Contact ────────────────────────────────────────── */}
      <section id="contact" className="section">
        <div className="shell">
          <div className="panel">
            <div className="section-head">
              <p className="eyebrow">{contact.eyebrow}</p>
              <h2 className="h2">{contact.heading}</h2>
            </div>

            {/* The two runs are nowrap and JSX drops the whitespace between
                them, so <wbr> is the only break opportunity — at the @. */}
            <a className="contact-email" href={`mailto:${contact.email}`}>
              <span>
                {contact.email.slice(0, contact.email.indexOf("@") + 1)}
              </span>
              <wbr />
              <span>{contact.email.slice(contact.email.indexOf("@") + 1)}</span>
            </a>

            <ul className="contact-links">
              {contact.links.map((link) => (
                <li className="contact-row" key={link.label}>
                  <span className="contact-label mono">{link.label}</span>
                  {link.href ? (
                    <a
                      className="contact-value"
                      href={link.href}
                      target={
                        link.href.startsWith("http") ? "_blank" : undefined
                      }
                      rel={
                        link.href.startsWith("http")
                          ? "noreferrer noopener"
                          : undefined
                      }
                    >
                      {link.value}
                    </a>
                  ) : (
                    <span className="contact-value">
                      {link.value}
                      {link.note ? (
                        <span className="contact-todo mono"> ({link.note})</span>
                      ) : null}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <footer className="footer mono">
              <span>{identity.name}</span>
              <span>{contact.footnote}</span>
            </footer>
          </div>
        </div>
      </section>
    </main>
  );
}