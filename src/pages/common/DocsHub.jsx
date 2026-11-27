import { Link } from 'react-router-dom';
import {
  Terminal,
  Code2,
  Braces,
  Server,
  GitPullRequest,
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
    href: '/docs/sdk-reference-client',
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

const modelFamilies = [
  { name: 'Qwen', asset: 'qwen', href: 'https://huggingface.co/Qwen' },
  { name: 'Kimi', asset: 'kimi', href: 'https://huggingface.co/moonshotai' },
  { name: 'DeepSeek', asset: 'deepseek', href: 'https://huggingface.co/deepseek-ai' },
  { name: 'GPT-OSS', asset: 'gpt-oss', href: 'https://huggingface.co/openai' },
  { name: 'Llama', asset: 'llama', href: 'https://huggingface.co/meta-llama' },
  { name: 'Nemotron', asset: 'nemotron', href: 'https://huggingface.co/nvidia' },
  { name: 'Cogito', asset: 'cogito', href: 'https://huggingface.co/deepcogito' },
  { name: 'Bonsai', asset: 'bonsai', href: 'https://huggingface.co/prism-ml' },
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

      <section className="docs-hub__models" aria-labelledby="model-families-heading">
        <h2 id="model-families-heading">Model families</h2>

        <div className="docs-hub__model-grid">
          {modelFamilies.map(({ name, asset, href }) => (
            <a
              className="docs-model-card"
              href={href}
              key={asset}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} on Hugging Face (opens in a new tab)`}
            >
              <img
                className="docs-model-card__logo"
                src={`${import.meta.env.BASE_URL}models/${asset}.svg`}
                alt=""
                width={32}
                height={32}
                loading="lazy"
                onError={(event) => { event.currentTarget.hidden = true; }}
              />
              <span className="docs-model-card__name">{name}</span>
              <ArrowUpRight className="docs-model-card__arrow" size={13} strokeWidth={1.6} aria-hidden="true" />
            </a>
          ))}
        </div>

        <p className="docs-hub__model-note">Model availability depends on your inference provider.</p>
      </section>

      <div className="docs-hub__contributing">
        <Link className="docs-contributing-card" to="/docs/core-contributing">
          <div className="docs-card__icon docs-card__icon--neutral">
            <GitPullRequest size={18} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="docs-contributing-card__body">
            <h2>Contributing</h2>
            <p className="docs-card__blurb">Develop and extend Project David.</p>
          </div>
          <ArrowUpRight className="docs-contributing-card__arrow" size={14} strokeWidth={1.6} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
