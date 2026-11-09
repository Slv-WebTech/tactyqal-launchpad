// Secure by default: writes are CLOSED unless a key is configured.
//
//   ADMIN_KEY set                -> writes need the `x-admin-key` header (must be >= 24 chars)
//   no ADMIN_KEY                 -> writes rejected (401); the API is effectively read-only
//   ALLOW_OPEN_WRITES=1          -> explicit local-dev opt-in: anyone can write. Refused in production.
//
// A missing or mistyped environment variable can therefore never expose write access.
export function loadConfig(env = process.env) {
  const adminKey = env.ADMIN_KEY || null;
  const production = env.NODE_ENV === "production";
  const allowOpenWrites = env.ALLOW_OPEN_WRITES === "1";

  if (adminKey && adminKey.length < 24) {
    throw new Error("ADMIN_KEY must be at least 24 characters (try: openssl rand -base64 32)");
  }
  if (production && allowOpenWrites) {
    throw new Error("ALLOW_OPEN_WRITES=1 is not permitted when NODE_ENV=production");
  }
  return { adminKey, production, allowOpenWrites: allowOpenWrites && !adminKey };
}

export function describeMode(config) {
  if (config.adminKey) return "writes require the admin key";
  if (config.allowOpenWrites) return "WRITES OPEN (ALLOW_OPEN_WRITES=1, local development only)";
  return "READ-ONLY: writes are closed because no ADMIN_KEY is set";
}
