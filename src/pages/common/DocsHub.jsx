//src/pages/common/DocsHub.jsx
import { Link } from 'react-router-dom';
import './DocsHub.css';

export default function DocsHub() {

  const cards = [
  {
    href: '/docs/api-index',
    title: 'Developer SDK & API',
    blurb: 'Build AI-powered applications on a running Project David instance. Assistants, threads, tools, inference, fine-tuning, and full API reference.',
  },
  {
    href: '/docs/infra-index',
    title: 'Platform Operations',
    blurb: 'Deploy and operate the Project David sovereign AI stack. Docker images, cluster configuration, infrastructure management, and production deployment guides.',
  },
  {
    href: '/docs/role_resolution_algorithm',
    title: 'Algorithms & Architecture',
    blurb: 'Formal specifications, proofs, and architectural deep-dives for researchers and technically curious evaluators.',
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