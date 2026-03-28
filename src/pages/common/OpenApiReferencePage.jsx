// src/pages/common/OpenApiReferencePage.jsx
import './ApiReferencePage.css';
const OPENAPI_URL = import.meta.env.VITE_OPENAPI_URL || '/openapi.json';

export default function OpenApiReferencePage() {

  // We write the HTML directly here. No external file needed!
  // This uses Redoc to render the OpenAPI spec beautifully.
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
          // Initialize Redoc with your FastAPI URL
          Redoc.init('${OPENAPI_URL}', {}, document.getElementById('redoc-container'));
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