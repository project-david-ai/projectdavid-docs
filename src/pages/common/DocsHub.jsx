//src/pages/common/DocsHub.jsx
import { Link } from 'react-router-dom';
import './DocsHub.css';

export default function DocsHub() {
  const cards = [
    {
      // Use relative paths instead of absolute URLs
      href: '/docs/api-index',
      title: 'Entities API + SDK',
      blurb: 'Build with the Entities API REST endpoints and SDKs',
    },
    {
      // Use relative paths instead of absolute URLs
      href: '/docs/infra-index',
      title: 'Infrastructure Guide',
      blurb:
        'Hands-on guide to running the Entities API in your own environment. Fork the repo, ' +
        'explore the architecture, and follow step-by-step instructions for local development, ' +
        'testing, and production deployment',
    },
  ];

  return (
    <section className="docs-hub">
      <h1 className="docs-hub__title">Developer Documentation</h1>

      <div className="docs-hub__grid">
        {cards.map((c) => (
          <Link className="docs-card" to={c.href} key={c.href}>



            <h2 className="docs-card__heading">{c.title}</h2>
            <p className="docs-card__blurb">{c.blurb}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}