import { useEffect } from 'react'
import './Contact.css'

const EMAIL = 'info@botwatch.xyz'

// Public contact + responsible-disclosure page. The same inbox
// (info@botwatch.xyz) handles security reports and general inquiries; the
// machine-readable disclosure policy lives at /.well-known/security.txt.
export default function Contact() {
  useEffect(() => { document.title = 'Contact & responsible disclosure — botwatch.xyz' }, [])

  return (
    <div className="contact">
      <header className="contact-head">
        <div className="contact-eyebrow">Contact</div>
        <h1>Get in touch</h1>
        <p className="contact-lead">
          botwatch.xyz is an independent cybersecurity research project — we run honeypots and
          analyse how automated agents, crawlers, and threat actors behave across the web. Whether
          you're a security researcher with a disclosure or just have a question, we'd like to hear
          from you.
        </p>
      </header>

      <section className="contact-card contact-card--primary">
        <h2>Responsible disclosure</h2>
        <p>
          If you've found a security vulnerability in botwatch.xyz or our infrastructure, please
          report it privately so we can fix it before any details become public. We welcome
          good-faith research and won't pursue action against researchers who follow this policy.
        </p>
        <a className="contact-email" href={`mailto:${EMAIL}?subject=Security%20disclosure`}>{EMAIL}</a>

        <div className="contact-cols">
          <div>
            <h3>Please include</h3>
            <ul>
              <li>A clear description of the issue and its impact</li>
              <li>Steps to reproduce (a proof-of-concept if you have one)</li>
              <li>The URL(s), parameters, or requests involved</li>
              <li>How you'd like to be credited, if at all</li>
            </ul>
          </div>
          <div>
            <h3>Please don't</h3>
            <ul>
              <li>Run denial-of-service, spam, or automated brute-force tests</li>
              <li>Access, modify, or delete data that isn't yours</li>
              <li>Publicly disclose before we've had a chance to remediate</li>
              <li>Use findings for anything beyond good-faith testing</li>
            </ul>
          </div>
        </div>
        <p className="contact-note">
          Our machine-readable policy is published at{' '}
          <a href="/.well-known/security.txt">/.well-known/security.txt</a>. We aim to acknowledge
          reports within a few business days.
        </p>
      </section>

      <section className="contact-card">
        <h2>General inquiries</h2>
        <p>
          Questions about the platform, the API, data or partnership requests, or press — reach the
          same inbox and we'll route it to the right place.
        </p>
        <a className="contact-email" href={`mailto:${EMAIL}?subject=Inquiry`}>{EMAIL}</a>
      </section>

      <section className="contact-card">
        <h2>API &amp; account help</h2>
        <p>
          Using the botwatch API? The <a href="/docs">API docs</a> cover every endpoint, and you can
          manage keys and billing from your <a href="/account">account</a>. For anything not covered
          there, email us above.
        </p>
      </section>
    </div>
  )
}
