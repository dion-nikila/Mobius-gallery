/* global Buffer */
import { loadGitHubStudio, publishGitHubCatalog, stageGitHubImages } from "../src/studioGitHub.js";
import { validateCatalog } from "../src/catalog.js";
import {
  authConfig, seal, sessionCookie, sessionFor, setCookie, studioHeaders, studioJson, studioOrigin, unseal,
} from "../server/studio-auth.js";

function isWebp(input, maxBytes) {
  if (typeof input !== "string" || input.length > Math.ceil(maxBytes / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input)) return false;
  const bytes = Buffer.from(input, "base64");
  return bytes.length >= 16 && bytes.length <= maxBytes && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP";
}

async function stage(payload, config, session) {
  if (typeof payload.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(payload.id)
    || !isWebp(payload.image, 950000) || !isWebp(payload.thumbnail, 110000)) {
    return studioJson({ error: "Choose a valid optimized web image and thumbnail." }, 400);
  }
  const pair = await stageGitHubImages(session.token, payload);
  const ticket = seal(config.key, "artwork-upload", {
    id: payload.id, owner: session.id, pair, expires: Date.now() + 600_000,
  });
  return studioJson({ ticket });
}

async function publish(payload, config, session) {
  const { artworks, catalogSha, staged } = payload;
  validateCatalog({ schemaVersion: 1, artworks });
  if (typeof catalogSha !== "string" || !/^[a-f0-9]{40}$/.test(catalogSha) || !staged || typeof staged !== "object" || Array.isArray(staged)) {
    return studioJson({ error: "Reload the catalogue and try again." }, 400);
  }

  const artworkIds = new Set(artworks.map((artwork) => artwork.id));
  const images = Object.create(null);
  for (const [id, ticket] of Object.entries(staged)) {
    const uploaded = unseal(config.key, "artwork-upload", ticket);
    if (!artworkIds.has(id) || uploaded?.id !== id || uploaded.owner !== session.id) {
      return studioJson({ error: "An upload expired. Publish again to prepare another copy." }, 400);
    }
    images[id] = uploaded.pair;
  }

  return studioJson(await publishGitHubCatalog(session.token, catalogSha, artworks, images));
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return studioJson({ error: "Method not allowed." }, 405);
    if (new URL(request.url).origin !== studioOrigin || request.headers.get("origin") !== studioOrigin
      || request.headers.get("content-type")?.split(";")[0] !== "application/json") {
      return studioJson({ error: "Open Studio directly on chinesesatellite.art." }, 403);
    }

    try {
      const payload = await request.json();
      if (payload?.action === "signOut") {
        const headers = studioHeaders();
        headers.set("Set-Cookie", setCookie(sessionCookie));
        return Response.json({ signedIn: false }, { headers });
      }
      const config = authConfig();
      const session = sessionFor(request, config);
      if (!session) return studioJson({ error: "Your Studio session has expired. Sign in again." }, 401);
      if (payload?.action === "catalog") return studioJson(await loadGitHubStudio(session.token));
      if (payload?.action === "stage") return await stage(payload, config, session);
      if (payload?.action === "publish") return await publish(payload, config, session);
      return studioJson({ error: "Unknown Studio operation." }, 400);
    } catch (error) {
      return studioJson({ error: error instanceof Error ? error.message : "Studio couldn’t complete that request." }, 400);
    }
  },
};
