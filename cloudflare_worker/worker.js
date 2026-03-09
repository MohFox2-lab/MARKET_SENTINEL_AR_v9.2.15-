/**
 * Cloudflare Worker — Yahoo Chart Allowlisted Proxy
 * هدفه: يسمح فقط بطلبات Yahoo Finance chart endpoint
 * المسار: /yahoo?symbol=...&range=...&interval=...
 *
 * نشر سريع:
 * 1) أنشئ Worker جديد في Cloudflare
 * 2) ضع هذا الكود
 * 3) انشر وخذ الرابط: https://YOUR_SUBDOMAIN.workers.dev
 * 4) ضع الرابط في إعدادات التطبيق كـ "رابط البروكسي"
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (url.pathname !== "/yahoo") {
      return new Response(JSON.stringify({ ok:false, error:"Not Found" }), {
        status: 404,
        headers: { "content-type":"application/json; charset=utf-8", ...corsHeaders(request) }
      });
    }

    const symbol = (url.searchParams.get("symbol") || "").trim();
    const range = (url.searchParams.get("range") || "6mo").trim();
    const interval = (url.searchParams.get("interval") || "1d").trim();

    if (!symbol) {
      return new Response(JSON.stringify({ ok:false, error:"Missing symbol" }), {
        status: 400,
        headers: { "content-type":"application/json; charset=utf-8", ...corsHeaders(request) }
      });
    }

    const target = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
    target.searchParams.set("range", range);
    target.searchParams.set("interval", interval);
    target.searchParams.set("includePrePost", "false");
    target.searchParams.set("events", "div|split");

    const res = await fetch(target.toString(), {
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept": "application/json,text/plain,*/*",
      }
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60",
        ...corsHeaders(request),
      }
    });
  }
};

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}
