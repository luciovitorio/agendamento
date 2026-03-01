import Script from "next/script";

const swaggerInitializer = `
(function () {
  const cssHref = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css";

  function ensureSwaggerCss(onDone) {
    const alreadyLoaded = Array.from(
      document.querySelectorAll("link[rel='stylesheet']"),
    ).some((link) => link.href === cssHref);

    if (alreadyLoaded) {
      onDone();
      return;
    }

    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = cssHref;
    cssLink.onload = onDone;
    cssLink.onerror = onDone;
    document.head.appendChild(cssLink);
  }

  function initSwagger(retriesLeft) {
    if (window.SwaggerUIBundle && window.SwaggerUIStandalonePreset) {
      window.ui = window.SwaggerUIBundle({
        url: "/api/openapi/n8n",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        presets: [
          window.SwaggerUIBundle.presets.apis,
          window.SwaggerUIStandalonePreset,
        ],
        layout: "BaseLayout",
        tryItOutEnabled: true,
      });
      return;
    }

    if (retriesLeft <= 0) return;
    setTimeout(function () {
      initSwagger(retriesLeft - 1);
    }, 100);
  }

  ensureSwaggerCss(function () {
    initSwagger(50);
  });
})();
`;

export default function N8nApiDocsPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <header className="mb-5 rounded-lg border border-slate-200 bg-white p-4 md:p-5">
          <h1 className="text-xl font-semibold text-slate-900 md:text-2xl">
            Swagger - Integrações n8n
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Use{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              Authorization: Bearer &lt;N8N_APPOINTMENTS_TOKEN&gt;
            </code>{" "}
            ou{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5">
              x-n8n-token
            </code>{" "}
            para testar os endpoints.
          </p>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-1 md:p-2">
          <div id="swagger-ui" />
        </section>
      </div>

      <Script
        src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"
        strategy="afterInteractive"
      />
      <Script id="swagger-init" strategy="afterInteractive">
        {swaggerInitializer}
      </Script>
    </main>
  );
}
