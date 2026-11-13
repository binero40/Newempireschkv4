const ORIGIN = 'https://YOUR-VPS-IP:8080';

const CACHE_TTL = {
  static: 86400,
  api: 60,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    const securityHeaders = {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    // ── Rate limit (KV) ──────────────────────────────────────
    // En wrangler.toml:
    //   [[kv_namespaces]]
    //   binding = "RATE_LIMIT"
    //   id = "tu-kv-id"
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rlKey = `rl:${ip}`;

    if (env.RATE_LIMIT) {
      const existing = await env.RATE_LIMIT.get(rlKey, 'json');
      const now = Date.now();

      if (existing && now - existing.ts < 60_000) {
        if (existing.count >= 100) {
          return new Response('Rate limited', {
            status: 429,
            headers: securityHeaders,
          });
        }
        existing.count++;
        ctx.waitUntil(env.RATE_LIMIT.put(rlKey, JSON.stringify(existing)));
      } else {
        ctx.waitUntil(env.RATE_LIMIT.put(rlKey, JSON.stringify({ count: 1, ts: now })));
      }
    }
    // ─────────────────────────────────────────────────────────

    // ── Static assets ────────────────────────────────────────
    if (
      url.pathname === '/' ||
      url.pathname.startsWith('/public/') ||
      url.pathname === '/admin'
    ) {
      // ctx.caches.default es la única cache disponible
      const cached = await ctx.caches.default.get(request);
      if (cached) return cached;

      const originUrl = new URL(url.pathname, ORIGIN).toString();
      const originRes = await fetch(originUrl, { method, headers: request.headers });

      const res = new Response(originRes.body, {
        status: originRes.status,
        statusText: originRes.statusText,
        headers: new Headers(originRes.headers),
      });
      Object.entries(securityHeaders).forEach(([k, v]) => res.headers.set(k, v));

      if (url.pathname.startsWith('/public/')) {
        res.headers.set('Cache-Control', `public, max-age=${CACHE_TTL.static}`);
      }

      // Solo cachear 200
      if (originRes.status === 200) {
        ctx.waitUntil(ctx.caches.default.put(request, res.clone()));
      }
      return res;
    }

    // ── API routes ───────────────────────────────────────────
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      const originUrl = new URL(url.pathname + url.search, ORIGIN).toString();

      const originReq = new Request(originUrl, {
        method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(method) ? undefined : request.body,
      });

      const originRes = await fetch(originReq);

      const res = new Response(originRes.body, {
        status: originRes.status,
        statusText: originRes.statusText,
        headers: new Headers(originRes.headers),
      });
      Object.entries(securityHeaders).forEach(([k, v]) => res.headers.set(k, v));

      if (method === 'GET' && url.pathname.startsWith('/api/checker/results')) {
        res.headers.set('Cache-Control', `public, max-age=${CACHE_TTL.api}`);
        if (originRes.status === 200) {
          ctx.waitUntil(ctx.caches.default.put(request, res.clone()));
        }
      }
      return res;
    }

    return new Response('Not Found', { status: 404, headers: securityHeaders });
  },
};
