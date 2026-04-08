export function DecisionTimeline() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-600/80 bg-slate-900/20 p-8 sm:p-10">
      <h3 className="text-xl font-semibold text-slate-200">Decision journey</h3>
      <div className="mt-4 max-w-3xl space-y-4 text-base leading-relaxed text-slate-500">
        <p>
          A step-by-step timeline of how consensus evolved will appear here when the API exposes per-step crowd
          state (e.g. results or crowd-state history).
        </p>
        <p>For this release, use the verdict and archetype panels above for the narrative.</p>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3 pb-2">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex shrink-0 items-center gap-3">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-center">
              <div className="text-sm uppercase tracking-wide text-slate-500">Step {step}</div>
              <div className="mt-2 text-base text-slate-600">—</div>
            </div>
            {step < 4 && <span className="text-slate-600">→</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
