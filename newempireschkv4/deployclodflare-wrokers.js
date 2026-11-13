const ORIGIN = 'https://TU-IP-8080'; // ← tu IP:puerto real

const CACHE_TTL = {
  static: 86400,
  api: 60,
  admin: 0,
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

    // ── Static ──
    if (url.pathname === '/' || url.pathname.startsWith('/public/') || url.pathname === '/admin') {
      const originRes = await fetch(new URL(url.pathname, ORIGIN).toString(), { method, headers: request.headers });

      const res = new Response(originRes.body, {
        status: originRes.status,
        statusText: originRes.statusText,
        headers: new Headers(originRes.headers),
      });
      for (const [k, v] of Object.entries(securityHeaders)) res.headers.set(k, v);

      if (url.pathname.startsWith('/public/')) {
        res.headers.set('Cache-Control', `public, max-age=${CACHE_TTL.static}`);
      }
      return res;
    }

    // ── API ──
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      const originReq = new Request(new URL(url.pathname + url.search, ORIGIN).toString(), {
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
      for (const [k, v] of Object.entries(securityHeaders)) res.headers.set(k, v);

      if (method === 'GET' && url.pathname.startsWith('/api/checker/results')) {
        res.headers.set('Cache-Control', `public, max-age=${CACHE_TTL.api}`);
      }
      return res;
    }

    return new Response('Not Found', { status: 404, headers: securityHeaders });
  },
};
