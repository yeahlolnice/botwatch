import { Link } from 'react-router-dom'
import './Willowbot.css'

const USER_AGENT = 'Willowbot/v1.2 (+https://botwatch.xyz/willowbot)'

const behaviors = [
  {
    title: 'robots.txt is checked before every request',
    desc: 'Willowbot reads your robots.txt before fetching a single page. If a path — or your whole site — is disallowed for Willowbot (or for all bots via User-agent: *), it is never fetched.',
  },
  {
    title: 'One request at a time, with a delay between them',
    desc: 'Willowbot never crawls a site concurrently. It fetches one page, waits a couple of seconds, then fetches the next — the same site is never hit in a burst.',
  },
  {
    title: 'Only ordinary public pages',
    desc: 'Willowbot follows normal http/https links, sitemap.xml entries, and robots.txt Sitemap: declarations. It never touches internal, private, or non-routable network addresses.',
  },
  {
    title: 'It identifies itself honestly',
    desc: 'Every request carries a distinct, traceable User-Agent — never a spoofed browser string — so it always shows up clearly in your access logs as exactly what it is.',
  },
]

export default function Willowbot() {
  return (
    <main className="willowbot-page">
      <section className="wb-banner" style={{ backgroundImage: "url('/Willow-relax.jpg')" }}>
        <div className="wb-banner-overlay" />
        <div className="wb-hero">
          <div className="wb-badge">botwatch research crawler</div>
          <h1>Willowbot</h1>
          <p className="wb-desc">
            Willowbot is a small, polite web crawler run by botwatch as part of our research into
            how the world is adapting to the rapidly growing wave of AI traffic — LLM crawlers, AI
            agents, and automated scanning of every kind.
          </p>
          <div className="wb-actions">
            <Link to="/readiness" className="btn-primary">See what it's found →</Link>
            <a href="#how-to-block" className="btn-ghost">How to block it</a>
          </div>
        </div>
      </section>

      <div className="wb-content">

      <section className="wb-section">
        <h2 className="section-title">Why Willowbot exists</h2>
        <p className="section-sub">The other half of the botwatch picture</p>
        <p className="wb-body">
          botwatch normally watches traffic arriving at our own server — the bots, scanners, and
          crawlers that visit us. Willowbot points that same curiosity outward: instead of asking
          "who's visiting us?", it asks "how is the rest of the web preparing for the flood of AI
          traffic headed its way?" As AI agents and LLM crawlers make up a growing share of all
          web traffic, we wanted a running, public picture of how sites are actually adapting —
          not just anecdotes.
        </p>
      </section>

      <section className="wb-section">
        <h2 className="section-title">What it checks</h2>
        <p className="section-sub">Simple, publicly visible signals — nothing intrusive</p>
        <div className="wb-checks">
          <div className="wb-check-card">
            <h3>llms.txt</h3>
            <p>A proposed convention (like robots.txt or sitemap.xml) for pointing AI agents at a site's own canonical, LLM-friendly documentation. Willowbot checks whether a domain publishes one.</p>
          </div>
          <div className="wb-check-card">
            <h3>ai.txt</h3>
            <p>An emerging file for declaring how a site's content may be used by AI systems. Willowbot records whether one is present.</p>
          </div>
          <div className="wb-check-card">
            <h3>humans.txt</h3>
            <p>The long-standing convention for crediting the people behind a site. Willowbot notes whether a domain publishes one.</p>
          </div>
          <div className="wb-check-card">
            <h3>robots.txt &amp; AI-crawler rules</h3>
            <p>Beyond obeying it, Willowbot records whether a site has a robots.txt and whether it declares explicit rules for known AI-training crawlers — a signal of how the site is responding to AI.</p>
          </div>
          <div className="wb-check-card">
            <h3>JSON-LD structured data</h3>
            <p>schema.org markup embedded in a page's HTML that makes its content machine-readable. Willowbot notes whether a page has it and what types it declares.</p>
          </div>
        </div>
        <p className="wb-body">
          The aggregate results — never anything about a specific person — are published live on
          the <Link to="/readiness">AI Readiness</Link> page.
        </p>
      </section>

      <section className="wb-section">
        <h2 className="section-title">How Willowbot behaves</h2>
        <p className="section-sub">The rules it follows on every single request</p>
        <div className="steps">
          {behaviors.map((b, i) => (
            <div className="step" key={b.title}>
              <span className="step-num">{i + 1}</span>
              <div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="wb-section" id="how-to-block">
        <h2 className="section-title">How to block Willowbot</h2>
        <p className="section-sub">You're always in control — this is honored automatically, no need to contact us</p>
        <p className="wb-body">
          Willowbot identifies itself with this exact User-Agent on every request:
        </p>
        <pre className="wb-pre">{USER_AGENT}</pre>
        <p className="wb-body">
          To block just Willowbot while allowing other bots, add this to your <code>robots.txt</code>:
        </p>
        <pre className="wb-pre">{'User-agent: Willowbot\nDisallow: /'}</pre>
        <p className="wb-body">
          To block all automated crawlers, including Willowbot:
        </p>
        <pre className="wb-pre">{'User-agent: *\nDisallow: /'}</pre>
        <p className="wb-body">
          Either rule takes effect on Willowbot's next visit — robots.txt is re-checked before
          every crawl, nothing is cached indefinitely.
        </p>
      </section>

      <div className="wb-footer">
        <span>Part of the botwatch research project.</span>
        <Link to="/">← Back to home</Link>
      </div>

      </div>
    </main>
  )
}
