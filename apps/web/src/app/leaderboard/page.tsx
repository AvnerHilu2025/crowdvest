import { Suspense } from "react";
import { LeaderboardContent } from "./LeaderboardContent";

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
          <p style={{ marginTop: 24 }}>Loading…</p>
        </main>
      }
    >
      <LeaderboardContent />
    </Suspense>
  );
}
