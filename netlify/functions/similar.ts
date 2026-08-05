import type { Handler } from "@netlify/functions";

// Proxy for Last.fm artist.getSimilar. Holds the API key server-side (the key
// must never reach the browser) and sets a proper User-Agent. Returns the same
// { name, match } shape the frontend's mock data uses, so wiring is a drop-in.
const LASTFM = "https://ws.audioscrobbler.com/2.0/";
const UA = "SoundsLikeTree/0.1 (+https://github.com/)";

export const handler: Handler = async (event) => {
  const artist = (event.queryStringParameters?.artist || "").trim();
  const limit = Math.min(Math.max(Number(event.queryStringParameters?.limit) || 25, 1), 50);
  if (!artist) return json(400, { error: "Missing 'artist' query parameter." });

  const key = process.env.LASTFM_API_KEY;
  if (!key) return json(500, { error: "LASTFM_API_KEY is not configured on the server." });

  const url = new URL(LASTFM);
  url.searchParams.set("method", "artist.getsimilar");
  url.searchParams.set("artist", artist);
  url.searchParams.set("api_key", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");
  url.searchParams.set("limit", String(limit));

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429) return json(429, { error: "Last.fm rate limit — try again shortly." });
    if (!res.ok) return json(res.status, { error: `Last.fm returned ${res.status}` });

    const data: any = await res.json();
    if (data?.error) return json(400, { error: data.message || "Last.fm error", code: data.error });

    const raw = data?.similarartists?.artist ?? [];
    const similar = raw
      .map((a: any) => ({ name: String(a?.name || "").trim(), match: clamp01(parseFloat(a?.match)) }))
      .filter((x: { name: string }) => x.name);

    return json(200, { artist, similar }, 300);
  } catch {
    return json(502, { error: "Could not reach Last.fm." });
  }
};

function json(statusCode: number, body: unknown, cacheSeconds = 0) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      ...(cacheSeconds ? { "cache-control": `public, max-age=${cacheSeconds}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

function clamp01(n: number) {
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}
