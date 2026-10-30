function dayKey(tenantId, now = new Date()) {
  return `agent:budget:${tenantId}:${now.toISOString().slice(0, 10)}`;
}

export function createMemoryLimiter() {
  const hits = new Map();
  const spent = new Map();
  const cache = new Map();

  return {
    async take(key, limit, windowSec) {
      const now = Date.now();
      const fresh = (hits.get(key) || []).filter((ts) => now - ts < windowSec * 1000);
      if (fresh.length >= limit) {
        hits.set(key, fresh);
        return { ok: false, remaining: 0 };
      }
      fresh.push(now);
      hits.set(key, fresh);
      return { ok: true, remaining: limit - fresh.length };
    },
    async getSpent(tenantId) {
      return spent.get(dayKey(tenantId)) || 0;
    },
    async addSpent(tenantId, tokens) {
      if (!tokens) return;
      const key = dayKey(tenantId);
      spent.set(key, (spent.get(key) || 0) + tokens);
    },
    async getCache(key) {
      const row = cache.get(key);
      if (!row || row.exp < Date.now()) return null;
      return row.value;
    },
    async setCache(key, value, ttlSeconds) {
      cache.set(key, { value, exp: Date.now() + ttlSeconds * 1000 });
    },
  };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("redis timeout")), ms);
    }),
  ]);
}

export function createRedisLimiter(redis, timeoutMs = 300) {
  const memory = createMemoryLimiter();
  const safe = async (fn) => {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch {
      return null;
    }
  };

  return {
    async take(key, limit, windowSec) {
      const n = await safe(() => redis.incr(key));
      if (n == null) return memory.take(key, limit, windowSec);
      if (n === 1) await safe(() => redis.expire(key, windowSec));
      return { ok: n <= limit, remaining: Math.max(limit - n, 0) };
    },
    async getSpent(tenantId) {
      const n = await safe(() => redis.get(dayKey(tenantId)));
      if (n == null) return memory.getSpent(tenantId);
      return Number(n) || 0;
    },
    async addSpent(tenantId, tokens) {
      if (!tokens) return;
      const key = dayKey(tenantId);
      const n = await safe(() => redis.incrby(key, tokens));
      if (n == null) return memory.addSpent(tenantId, tokens);
      if (n === tokens) await safe(() => redis.expire(key, 60 * 60 * 48));
    },
    async getCache(key) {
      const raw = await safe(() => redis.get(`agent:cache:${key}`));
      if (raw == null) return memory.getCache(key);
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    async setCache(key, value, ttlSeconds) {
      const ok = await safe(() =>
        redis.set(`agent:cache:${key}`, JSON.stringify(value), "EX", ttlSeconds),
      );
      if (ok == null) return memory.setCache(key, value, ttlSeconds);
    },
  };
}
