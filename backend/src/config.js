// Fail closed: in production the API refuses to start without a strong admin key,
// so a missing env var can never silently make every write public.
export function loadConfig(env = process.env) {
  const adminKey = env.ADMIN_KEY || null;
  const production = env.NODE_ENV === "production";
  if (production && (!adminKey || adminKey.length < 24)) {
    throw new Error("ADMIN_KEY (at least 24 characters) is required when NODE_ENV=production");
  }
  return { adminKey, production };
}
