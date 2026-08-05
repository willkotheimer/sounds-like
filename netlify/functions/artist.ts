import type { Handler } from "@netlify/functions";

// Resolve an artist name -> Spotify (id, image, genres, followers) + a Last.fm bio.
// Spotify uses the Client Credentials flow (no user login, no redirect URI).
// The frontend builds the embed player from the returned Spotify id.

const UA = "SoundsLikeTree/0.1 (+https://github.com/)";

let spToken: string | null = null;
let spTokenExp = 0;

async function spotifyToken(id: string, secret: string): Promise<string> {
  if (spToken && Date.now() < spTokenExp) return spToken;
  const basic = Buffer.from(id + ":" + secret).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + basic,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) { const t = await res.text().catch(function () { return ""; }); throw new Error("token " + res.status + " " + t.slice(0, 160)); }
  const j: any = await res.json();
  spToken = j.access_token;
  spTokenExp = Date.now() + Math.max(0, (j.expires_in || 3600) - 60) * 1000;
  return spToken!;
}

export const handler: Handler = async (event) => {
  const name = (event.queryStringParameters?.name || "").trim();
  if (!name) return json(400, { error: "Missing 'name' query parameter." });

  const cid = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const lfm = process.env.LASTFM_API_KEY;

  let spotify: any = null;
  let spotifyError: string | null = null;
  if (cid && secret) {
    try {
      const token = await spotifyToken(cid, secret);
      const url =
        "https://api.spotify.com/v1/search?type=artist&limit=1&q=" +
        encodeURIComponent(name);
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) {
        const t = await res.text().catch(function () { return ""; });
        spotifyError = "search " + res.status + " " + t.slice(0, 160);
      } else {
        const data: any = await res.json();
        const a = data?.artists?.items?.[0];
        if (a) {
          spotify = {
            id: a.id,
            name: a.name,
            image: a.images?.[0]?.url || null,
            genres: a.genres || [],
            followers: a.followers?.total || 0,
          };
        } else {
          spotifyError = "no artist match";
        }
      }
    } catch (e: any) {
      spotifyError = String((e && e.message) || e);
    }
  }

  let bio: string | null = null;
  if (lfm) {
    try {
      const url =
        "https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=" +
        encodeURIComponent(name) +
        "&api_key=" + lfm + "&format=json&autocorrect=1";
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) {
        const data: any = await res.json();
        const raw = data?.artist?.bio?.summary || "";
        bio =
          raw
            .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "") // drop the "Read more on Last.fm" link
            .replace(/\s+/g, " ")
            .trim() || null;
      }
    } catch {
      /* leave bio null */
    }
  }

  // Don't CDN-cache failures — otherwise a bad response sticks for an hour.
  return json(200, { name, spotify, bio, configured: !!(cid && secret), spotifyError }, spotify ? 3600 : 0);
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
