import * as fs from 'fs';

/**
 * Resolves a PEM key with production-first priority:
 *   1. `${envBase64Var}` — base64-encoded PEM, the production/Railway/Render path
 *      (env vars are single-line and platform UIs don't cope well with raw
 *      multi-line PEM, so base64 is what we ask deployers to paste).
 *   2. A local file at `${envPathVar}` (or `defaultPath`) — development only.
 *      In production this path is refused outright: mounting key files onto a
 *      PaaS container is fragile and easy to forget, so failing loudly here
 *      beats silently booting with no keys.
 */
function resolveKey(envBase64Var: string, envPathVar: string, defaultPath: string, label: string): string {
  const base64 = process.env[envBase64Var];
  if (base64 && base64.trim()) {
    try {
      const decoded = Buffer.from(base64.trim(), 'base64').toString('utf8');
      if (!decoded.includes('BEGIN')) throw new Error('decoded value does not look like a PEM key');
      return decoded;
    } catch (e) {
      throw new Error(`Could not decode ${envBase64Var} as base64 PEM: ${(e as Error).message}`);
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const filePath = process.env[envPathVar] ?? defaultPath;

  if (isProduction) {
    throw new Error(
      `${label} is not configured. Set ${envBase64Var} (base64-encoded PEM) as an environment variable — ` +
        `required in production. File-based keys (${envPathVar}) are development-only and are not read when NODE_ENV=production. ` +
        `Run "bash scripts/generate-jwt-keys.sh" locally, then use the base64 values it prints.`,
    );
  }

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(
      `Could not read ${label} at "${filePath}". Run "bash scripts/generate-jwt-keys.sh" to generate a dev keypair, ` +
        `set ${envPathVar}, or set ${envBase64Var} to use the same base64 flow production uses.`,
    );
  }
}

/**
 * Redis connection. REDIS_URL (what Railway's Redis plugin exposes, e.g.
 * redis://default:secret@redis.railway.internal:6379) wins when set; otherwise
 * the separate REDIS_HOST / REDIS_PORT / REDIS_USERNAME / REDIS_PASSWORD vars.
 * Managed Redis on Railway always requires a password, so host + port alone
 * fail with NOAUTH there.
 */
function resolveRedis() {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    };
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '20', 10),
    authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '5', 10),
  },
  jwt: {
    accessPrivateKey: resolveKey('JWT_ACCESS_PRIVATE_KEY_BASE64', 'JWT_ACCESS_PRIVATE_KEY_PATH', './keys/access-private.pem', 'the JWT access private key'),
    accessPublicKey: resolveKey('JWT_ACCESS_PUBLIC_KEY_BASE64', 'JWT_ACCESS_PUBLIC_KEY_PATH', './keys/access-public.pem', 'the JWT access public key'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresInDays: parseInt(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? '30', 10),
  },
  redis: resolveRedis(),
});
