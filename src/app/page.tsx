export default function HomePage() {
  const defaultProjectId = "demo-project-01";

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
              Accordly
            </h1>
            <p className="text-slate-600 max-w-xl">
              AI-assisted commercial workflow: connecting agreed scope baselines to change requests, client approval, and verified PayPal invoicing.
            </p>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full border border-blue-200">
            MVP Demo
          </span>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Active Core Workflows
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href={`/projects/${defaultProjectId}/baseline`}
              className="group block p-5 rounded-lg border border-slate-200 hover:border-blue-500 hover:shadow-md transition bg-slate-50/50 hover:bg-white"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  Phase 2: Contract Intelligence
                </span>
                <span className="text-slate-400 group-hover:text-blue-500 font-bold transition">→</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                Agreement Ingestion & Scope Baseline
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Upload signed contract (PDF/TXT), extract 7 core scope categories with citations, review, and confirm baseline.
              </p>
            </a>

            <div className="p-5 rounded-lg border border-emerald-200 bg-emerald-50/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Phase 1: Payments Active
                </span>
                <span className="text-emerald-600 font-bold">✓</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2">
                PayPal Sandbox Integration
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Verified OAuth 2.0 and Invoicing v2 service (draft invoice creation, sending, and API reconciliation).
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

