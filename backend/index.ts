// myWorkoutPal API — Railway Function (Bun + Hono + Postgres)
// Tables are prefixed mwp_ so they live safely alongside other apps in the same database.
import { Hono } from "hono@4";
import { SQL } from "bun";

const db = new SQL(Bun.env.DATABASE_URL!);

await db`CREATE TABLE IF NOT EXISTS mwp_users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
await db`CREATE TABLE IF NOT EXISTS mwp_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES mwp_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
await db`CREATE TABLE IF NOT EXISTS mwp_user_data (
  user_id INTEGER PRIMARY KEY REFERENCES mwp_users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;

const MAX_DATA_BYTES = 2_000_000;
const SESSION_DAYS = 180;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Very small in-memory rate limiter for auth endpoints (per IP, per minute).
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string, max = 20): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n++;
  return h.n > max;
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function issueSession(userId: number): Promise<string> {
  const token = newToken();
  await db`INSERT INTO mwp_sessions (token, user_id) VALUES (${token}, ${userId})`;
  return token;
}

async function userFromAuth(header: string | undefined) {
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const rows = await db`
    SELECT u.id, u.email, u.name, s.token FROM mwp_sessions s
    JOIN mwp_users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.created_at > now() - make_interval(days => ${SESSION_DAYS}::int)`;
  if (!rows.length) return null;
  await db`UPDATE mwp_sessions SET last_seen = now() WHERE token = ${token}`;
  return rows[0] as { id: number; email: string; name: string; token: string };
}

async function loadData(userId: number) {
  const rows = await db`SELECT data, updated_at FROM mwp_user_data WHERE user_id = ${userId}`;
  if (!rows.length) return { data: null, updatedAt: null };
  const d = rows[0].data;
  return { data: typeof d === "string" ? JSON.parse(d) : d, updatedAt: rows[0].updated_at };
}

const app = new Hono();
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Max-Age": "86400" } });
  }
  await next();
  c.res.headers.set("Access-Control-Allow-Origin", "*");
});

app.get("/", c => c.json({ service: "myWorkoutPal API", ok: true }));
app.get("/health", async c => { await db`SELECT 1`; return c.json({ ok: true }); });

app.post("/api/signup", async c => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0] ?? "?";
  if (limited(ip)) return c.json({ error: "Too many attempts. Try again in a minute." }, 429);
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 80);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(body.password ?? "");
  if (!name) return c.json({ error: "Tell us your name." }, 400);
  if (!EMAIL_RE.test(email)) return c.json({ error: "Enter a valid email address." }, 400);
  if (password.length < 6) return c.json({ error: "Password needs at least 6 characters." }, 400);
  if (password.length > 200) return c.json({ error: "Password is too long." }, 400);
  const existing = await db`SELECT id FROM mwp_users WHERE email = ${email}`;
  if (existing.length) return c.json({ error: "An account with this email already exists. Log in instead." }, 409);
  const passHash = await Bun.password.hash(password, { algorithm: "argon2id" });
  const [user] = await db`INSERT INTO mwp_users (email, name, pass_hash) VALUES (${email}, ${name}, ${passHash}) RETURNING id, email, name`;
  const initial = body.data && typeof body.data === "object" ? body.data : {};
  await db`INSERT INTO mwp_user_data (user_id, data) VALUES (${user.id}, ${JSON.stringify(initial)}::jsonb)`;
  const token = await issueSession(user.id);
  return c.json({ token, user: { email: user.email, name: user.name }, data: initial, updatedAt: new Date().toISOString() });
});

app.post("/api/login", async c => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0] ?? "?";
  if (limited(ip)) return c.json({ error: "Too many attempts. Try again in a minute." }, 429);
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const rows = await db`SELECT id, email, name, pass_hash FROM mwp_users WHERE email = ${email}`;
  const ok = rows.length ? await Bun.password.verify(password, rows[0].pass_hash) : false;
  if (!ok) return c.json({ error: "Email or password is incorrect." }, 401);
  const u = rows[0];
  const token = await issueSession(u.id);
  const { data, updatedAt } = await loadData(u.id);
  return c.json({ token, user: { email: u.email, name: u.name }, data, updatedAt });
});

app.get("/api/me", async c => {
  const u = await userFromAuth(c.req.header("authorization"));
  if (!u) return c.json({ error: "Please log in again." }, 401);
  const { data, updatedAt } = await loadData(u.id);
  return c.json({ user: { email: u.email, name: u.name }, data, updatedAt });
});

app.put("/api/data", async c => {
  const u = await userFromAuth(c.req.header("authorization"));
  if (!u) return c.json({ error: "Please log in again." }, 401);
  const raw = await c.req.text();
  if (raw.length > MAX_DATA_BYTES) return c.json({ error: "Data too large." }, 413);
  let body: any;
  try { body = JSON.parse(raw); } catch { return c.json({ error: "Invalid JSON." }, 400); }
  if (!body || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) return c.json({ error: "Missing data." }, 400);
  const [row] = await db`
    INSERT INTO mwp_user_data (user_id, data, updated_at) VALUES (${u.id}, ${JSON.stringify(body.data)}::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    RETURNING updated_at`;
  return c.json({ ok: true, updatedAt: row.updated_at });
});

app.post("/api/logout", async c => {
  const u = await userFromAuth(c.req.header("authorization"));
  if (u) await db`DELETE FROM mwp_sessions WHERE token = ${u.token}`;
  return c.json({ ok: true });
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong on the server." }, 500);
});

export default { port: Number(Bun.env.PORT ?? 3000), fetch: app.fetch };
