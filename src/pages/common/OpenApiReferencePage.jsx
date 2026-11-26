import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

const configuration = {
  url: '/openapi.json',

  layout: 'modern',
  theme: 'default',

  darkMode: false,
  forceDarkModeState: 'light',
  hideDarkModeToggle: true,

  showSidebar: true,
  showDeveloperTools: 'never',

  hideClientButton: true,
  hideTestRequestButton: true,

  persistAuth: false,
  telemetry: false,
  withDefaultFonts: false,

  agent: {
    disabled: true,
  },

  customCss: `
    .scalar-app {
      --scalar-font: "DM Sans", sans-serif;
      --scalar-font-code: Consolas, monospace;
    }
  `,
};

export default function OpenApiReferencePage() {
  return (
    <div className="scalar-reference">
      <ApiReferenceReact configuration={configuration} />
    </div>
  );
}