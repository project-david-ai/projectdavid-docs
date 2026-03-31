// src/pages/common/DocsHub.jsx
import { Link } from 'react-router-dom';
import './DocsHub.css';

const cards = [
  {
    href: '/docs/core-overview',
    title: 'Project David Core',
    blurb: 'The runtime engine. Clone the repository, explore the API architecture, and run the core inference and orchestration stack directly.',
  },
  {
    href: '/docs/platform-overview',
    title: 'Project David Platform',
    blurb: 'The containerised deployment of Project David Core. Pull the pre-built Docker images, configure your environment, and bring up the full sovereign AI stack with a single command.',
  },
  {
    href: '/docs/sdk-lifecycle',
    title: 'Developer SDK & API',
    blurb: 'Build AI-powered applications on a running Project David instance. Assistants, threads, tools, inference, fine-tuning, and full API reference.',
  },

  {
  href: '/docs/fine-tuning-pipeline',
  title: 'Sovereign Forge',
  blurb: 'Fine-tune open-weight models entirely on your own infrastructure. Domain adaptation, LoRA training, and adapter deployment — no data leaves the deployment boundary.',
},


];

export default function DocsHub() {
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