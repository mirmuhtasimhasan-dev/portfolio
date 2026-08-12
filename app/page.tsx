import { content } from "@/lib/content";
import PillNav from "@/components/PillNav";
import HeroName from "@/components/HeroName";
import AboutDevice from "@/components/AboutDevice";
import LivingCard from "@/components/LivingCard";
import AboutStats from "@/components/AboutStats";
import ProjectShowcase from "@/components/ProjectShowcase";

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

        <HeroName text={identity.greeting} />

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

      {/* ── 2 · About ───────────────────────────────────────────
          One About, on the lid. The device carries the real card rather
          than a capture of it, so the copy is live text and the mesh
          behind the glass answers the cursor here as it does anywhere. */}
      <section id="about">
        <AboutDevice>
          <LivingCard>
            <div className="section-head">
              <p className="eyebrow">{about.eyebrow}</p>
            </div>

            <div className="about-grid">
              <div className="about-copy">
                <h2 className="h2 about-quote">{about.heading}</h2>

                <ul className="about-pills">
                  {about.stack.map((tool) => (
                    <li className="pill mono" key={tool}>
                      {tool}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="about-copy">
                {about.body.map((paragraph) => (
                  <p className="prose" key={paragraph.slice(0, 24)}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>

            <AboutStats items={about.stats} />
          </LivingCard>
        </AboutDevice>
      </section>

      {/* ── 3 · Projects ─────────────────────────────────────────
          A horizontal showcase on a vertical scroll: the section pins and
          the rail slides sideways, one project at a time. It sits with
          About because the two share a motion — the same spring carries
          the lid open and the rail across. */}
      <section id="projects">
        <ProjectShowcase
          eyebrow={projects.eyebrow}
          heading={projects.heading}
          items={projects.items}
        />
      </section>

      {/* ── 4 · Experience ─────────────────────────────────────── */}
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