import type { Handler } from "@netlify/functions";

// Proxy for Last.fm artist.search — used to seed the tree from a typed query.
const LASTFM = "https://ws.audioscrobbler.com/2.0/";
const UA = "SoundsLikeTree/0.1 (+https://github.com/)";

export const handler: Handler = async (event) => {
  const q = (event.queryStringParameters?.q || "").trim();
  if (!q) return json(400, { error: "Missing 'q' query parameter." });

  const key = process.env.LASTFM_API_KEY;
  if (!key) return json(500, { error: "LASTFM_API_KEY is not configured on the server." });

  const url = new URL(LASTFM);
  url.searchParams.set("method", "artist.search");
  url.searchParams.set("artist", q);
  url.searchParams.set("api_key", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "8");

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429) return json(429, { error: "Last.fm rate limit — try again shortly." });
    if (!res.ok) return json(res.status, { error: `Last.fm returned ${res.status}` });

    const data: any = await res.json();
    if (data?.error) return json(400, { error: data.message || "Last.fm error", code: data.error });

    const raw = data?.results?.artistmatches?.artist ?? [];
    const results = raw
      .map((a: any) => ({ name: String(a?.name || "").trim(), listeners: Number(a?.listeners) || 0 }))
      .filter((x: { name: string }) => x.name);

    return json(200, { query: q, results }, 300);
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
