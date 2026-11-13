/**
 * Cloudflare Worker - Proxy / Edge cache layer for New Empires Amazon
 * 
 * This worker:
 * 1. Handles edge routing
 * 2. Adds security headers
 * 3. Caches static assets
 * 4. Proxies API calls to your origin (VPS / Cloudflare Pages)
 * 5. Rate-limits per IP
 */

const ORIGIN = 'https://YOUR-VPS-IP:8080'; // Replace with your VPS

const CACHE_TTL = {
  static: 86400,    // 24h for CSS/JS
  api: 60,          // 60s for API responses
  admin: 0,         // No cache for admin
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // Security headers
    const securityHeaders = {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    // Rate limit (simple: 100 req/min per IP)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rlKey = `rl:${ip}`;
    const cache = await caches.open('rate-limit');
    const existing = await cache.get(rlKey);
    
    if (existing) {
      const count = existing.json ? await existing.json() : { count: 0, ts: 0 };
      const now = Date.now();
      if (now - count.ts < 60000 && count.count >= 100) {
        return new Response('Rate limited', { status: 429, headers: securityHeaders });
      }
      count.count++;
      if (now - count.ts >= 60000) { count.count = 1; count.ts = now; }
      ctx.waitUntil(cache.put(rlKey, new Response(JSON.stringify(count))));
    } else {
      ctx.waitUntil(cache.put(rlKey, new Response(JSON.stringify({ count: 1, ts: Date.now() }))));
    }

    // Static assets - serve from Cloudflare Pages or cache
    if (url.pathname === '/' || url.pathname.startsWith('/public/') || url.pathname === '/admin') {
      const cached = await caches.match(request);
      if (cached) return cached;

      const originRes = await fetch(new URL(url.pathname, ORIGIN).toString(), request);
      const res = new Response(originRes.body, originRes);
      res.headers = new Headers({ ...securityHeaders, ...originRes.headers });
      if (url.pathname.startsWith('/public/')) {
        res.headers.set('Cache-Control', `public, max-age=${CACHE_TTL.static}`);
      }
      ctx.waitUntil(caches.open('static').put(request, res.clone()));
      return res;
    }

    // API routes - proxy to origin
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      const originReq = new Request(new URL(url.pathname + url.search, ORIGIN).toString(), {
        method,
        headers: request.headers,
        body: method === 'GET' ? undefined : request.body,
      });

      const originRes = await fetch(originReq);
      const res = new Response(originRes.body, originRes);
      res.headers = new Headers({ ...securityHeaders, ...originRes.headers });
      if (method === 'GET' && url.pathname.startsWith('/api/checker/results')) {
        res.headers.set('Cache-Control', `public, max-age=${CACHE_TTL.api}`);
        ctx.waitUntil(caches.open('api').put(request, res.clone()));
      }
      return res;
    }

    return new Response('Not Found', { status: 404, headers: securityHeaders });
  }
};