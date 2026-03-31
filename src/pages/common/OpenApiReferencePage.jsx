// src/pages/common/OpenApiReferencePage.jsx
import './ApiReferencePage.css';

export default function OpenApiReferencePage() {

  const iframeHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>API Reference</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="redoc-container"></div>
        <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
        <script>
          const specUrl = window.parent.location.origin + '/openapi.json';
          Redoc.init(specUrl, {}, document.getElementById('redoc-container'));
        </script>
      </body>
    </html>
  `;

  return (
    <div className="api-reference-wrap">
      <iframe
        srcDoc={iframeHtml}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="API Reference"
      />
    </div>
  );
}
