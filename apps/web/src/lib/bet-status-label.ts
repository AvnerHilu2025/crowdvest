/** Align API bet status with display: OPEN -> "Open", SETTLED -> "Settled" (not "Pending"). */
export function formatBetStatus(status: string): string {
  switch (String(status).toUpperCase()) {
    case "OPEN":
      return "Open";
    case "SETTLED":
      return "Settled";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status || "—";
  }
}
