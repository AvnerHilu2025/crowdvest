export function getWebBase(): string {
  return process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:4000";
}
