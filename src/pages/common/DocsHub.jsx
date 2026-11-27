import { Link } from 'react-router-dom';
import {
  Terminal,
  Code2,
  Braces,
  Server,
  ArrowUpRight,
} from 'lucide-react';
import './DocsHub.css';

const cards = [
  {
    href: '/docs/sdk-quick-start',
    title: 'Quickstart',
    description: 'Install the SDK and run your first agent.',
    icon: Terminal,
    tone: 'sage',
  },
  {
    href: '/docs/sdk-lifecycle',
    title: 'Python SDK',
    description: 'Build applications with Project David.',
    icon: Code2,
    tone: 'lavender',
  },
  {
    href: '/docs/api-reference',
    title: 'API reference',
    description: 'Endpoints, schemas and request examples.',
    icon: Braces,
    tone: 'peach',
  },
  {
    href: '/docs/platform-overview',
    title: 'Self-hosting',
    description: 'Deploy Project David on your infrastructure.',
    icon: Server,
    tone: 'neutral',
  },
];

export default function DocsHub() {
  return (
    <section className="docs-hub">
      <h1>Documentation</h1>

      <div className="docs-hub__grid">
        {cards.map(({ href, title, description, icon: Icon, tone }) => (
          <Link className="docs-card" to={href} key={href}>
            <div className={`docs-card__icon docs-card__icon--${tone}`}>
              <Icon size={18} strokeWidth={1.7} />
            </div>

            <h2 className="docs-card__heading">
              {title}
              <ArrowUpRight size={14} strokeWidth={1.6} />
            </h2>

            <p className="docs-card__blurb">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}