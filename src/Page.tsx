// The demo web page, rendered once in English and once per translation. Every
// translatable element carries data-seg so the two layouts can be aligned.
import type { Translations } from "./content"

type Props = { t: Translations; lang: string; variant?: "base" | "lens"; hidden?: boolean }

export function Page({ t, lang, variant = "base", hidden }: Props) {
  return (
    <article className={`page page-${variant}`} lang={lang} aria-hidden={hidden || undefined}>
      <header className="page-nav">
        <span className="brand" data-seg="brand">
          {t.brand}
        </span>
        <nav className="page-links">
          <a href="#tours" data-seg="nav.tours">
            {t["nav.tours"]}
          </a>
          <a href="#gear" data-seg="nav.gear">
            {t["nav.gear"]}
          </a>
          <a href="#contact" data-seg="nav.contact">
            {t["nav.contact"]}
          </a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow" data-seg="hero.eyebrow">
            {t["hero.eyebrow"]}
          </span>
          <h1 data-seg="hero.title">{t["hero.title"]}</h1>
          <p data-seg="hero.p1">{t["hero.p1"]}</p>
          <p data-seg="hero.p2">{t["hero.p2"]}</p>
          <div className="cta-row">
            <a className="cta" href="#book" data-seg="hero.cta">
              {t["hero.cta"]}
            </a>
            <span className="note" data-seg="hero.note">
              {t["hero.note"]}
            </span>
          </div>
        </div>
        <HeroArt />
      </section>

      <section className="block">
        <h2 data-seg="bring.title">{t["bring.title"]}</h2>
        <ul>
          {["bring.1", "bring.2", "bring.3", "bring.4"].map((id) => (
            <li key={id} data-seg={id}>
              {t[id]}
            </li>
          ))}
        </ul>
      </section>

      <section className="block">
        <h2 data-seg="route.title">{t["route.title"]}</h2>
        <p data-seg="route.p">{t["route.p"]}</p>
      </section>

      <section className="block">
        <h2 data-seg="faq.title">{t["faq.title"]}</h2>
        <dl className="faq">
          {[1, 2, 3].map((n) => (
            <div key={n} className="faq-item">
              <dt data-seg={`faq.q${n}`}>{t[`faq.q${n}`]}</dt>
              <dd data-seg={`faq.a${n}`}>{t[`faq.a${n}`]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="page-footer" data-seg="footer">
        {t.footer}
      </footer>
    </article>
  )
}

function HeroArt() {
  return (
    <svg className="hero-art" aria-hidden="true" width="300" height="400" viewBox="0 0 300 400">
      <rect width="300" height="400" fill="#D9E2E3" />
      <circle cx="200" cy="140" r="34" fill="#F2C46B" />
      <rect y="240" width="300" height="160" fill="#7F9DA6" />
      <path d="M0 276 Q 37 268 75 276 T 150 276 T 225 276 T 300 276" fill="none" stroke="#E9EEEE" strokeWidth="2" />
      <path d="M0 320 Q 37 312 75 320 T 150 320 T 225 320 T 300 320" fill="none" stroke="#E9EEEE" strokeWidth="2" opacity="0.6" />
      <path d="M0 364 Q 37 356 75 364 T 150 364 T 225 364 T 300 364" fill="none" stroke="#E9EEEE" strokeWidth="2" opacity="0.35" />
      <path d="M70 252 L230 252 Q 210 264 150 264 Q 90 264 70 252 Z" fill="#1B1B1A" />
      <line x1="120" y1="226" x2="180" y2="266" stroke="#1B1B1A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="150" cy="240" r="7" fill="#1B1B1A" />
    </svg>
  )
}
