// src/components/LifecycleBar/LifecycleBar.jsx

import { Link } from 'react-router-dom';
import './lifecyclebar.css';

const STEPS = [
  { key: 'create_assistant', label: 'create_assistant()', slug: 'sdk-assistants' },
  { key: 'create_thread',    label: 'create_thread()',    slug: 'sdk-threads' },
  { key: 'create_message',   label: 'create_message()',   slug: 'sdk-messages' },
  { key: 'create_run',       label: 'create_run()',       slug: 'sdk-runs' },
  { key: 'stream_events',    label: 'stream_events()',    slug: 'sdk-inference' },
  { key: 'tool_calls',       label: 'tool calls',         slug: 'function-calling-and-tool-execution' },
];

export default function LifecycleBar({ currentStep }) {
  return (
    <nav className="lifecycle-bar">
      {STEPS.map((step, i) => (
        <div key={step.key} className="lifecycle-bar__item">
          <Link
            to={`/docs/${step.slug}`}
            className={`lifecycle-bar__step ${step.key === currentStep ? 'lifecycle-bar__step--active' : ''}`}
          >
            {step.label}
          </Link>
          {i < STEPS.length - 1 && (
            <span className="lifecycle-bar__arrow">→</span>
          )}
        </div>
      ))}
    </nav>
  );
}