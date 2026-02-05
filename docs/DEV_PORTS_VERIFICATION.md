# Dev ports – verification checklist

Fixed ports for local dev:

- **Web (Next.js):** http://localhost:4000  
- **API (NestJS):** http://localhost:4001  

If a port is in use, dev fails fast with a clear message (no silent fallback to another port).

---

## File changes summary

| File | Change |
|------|--------|
| `package.json` (root) | `dev` script prints URLs then runs `turbo dev` |
| `apps/web/package.json` | `dev`: run `scripts/check-port.js 4000` then `PORT=4000 next dev --port 4000` |
| `apps/api/package.json` | `dev`: run `scripts/check-port.js 4001` then `PORT=4001 nest start --watch` |
| `apps/api/src/main.ts` | Log `API: http://localhost:${port}` after listen |
| `scripts/check-port.js` | New: fail if port in use (EADDRINUSE) |
| `.env.example` | New: DATABASE_URL + note about ports |

---

## Verification commands

### 1. Port check script (port free)

```bash
node scripts/check-port.js 4000
echo $?   # expect 0
```

### 2. Port check script (port in use – fail fast)

```bash
# In one terminal:
pnpm --filter web dev
# In another (before stopping web):
node scripts/check-port.js 4000
# Expect: "Port 4000 is already in use. Free it or choose another."
echo $?   # expect 1
```

### 3. Run dev from root

```bash
pnpm dev
```

**Expected output (order may vary):**

- Line like: `Dev servers: Web http://localhost:4000 | API http://localhost:4001`
- Turbo runs `web` and `api` dev tasks
- Next.js: e.g. `▲ Next.js 15.x.x - Local: http://localhost:4000`
- API: `API: http://localhost:4001`

### 4. Run web only

```bash
pnpm --filter web dev
```

**Expected:** Next.js on http://localhost:4000 (and “Ready” / “Local: http://localhost:4000” in logs).

### 5. Run API only

```bash
pnpm --filter api dev
```

**Expected:** Nest starts and logs `API: http://localhost:4001`.  
`curl -s http://localhost:4001/health` (or your health route) returns 200.

### 6. Port in use – API

With something already bound to 4001 (e.g. another API instance):

```bash
pnpm --filter api dev
# Expect: "Port 4001 is already in use. Free it or choose another."
# Process exits with code 1
```

---

## Quick checklist

- [ ] `pnpm dev` prints Web and API URLs and both apps start
- [ ] Web UI at http://localhost:4000
- [ ] API at http://localhost:4001 (e.g. health or /results/runs)
- [ ] With 4000 in use, `pnpm --filter web dev` fails with “Port 4000 is already in use”
- [ ] With 4001 in use, `pnpm --filter api dev` fails with “Port 4001 is already in use”
