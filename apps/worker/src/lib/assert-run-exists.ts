/**
 * Preflight: ensure run exists via API before heavy work.
 * Throws with a clear message if run was deleted (e.g. after db:reset).
 */
export async function assertRunExists(apiBase: string, runId: string): Promise<void> {
  const url = `${apiBase.replace(/\/$/, "")}/runs/${runId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Run ${runId} not found (did you run db:reset?). Create a new run and rerun.`,
    );
  }
}
