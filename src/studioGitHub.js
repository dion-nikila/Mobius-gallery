import { catalogPath, validateCatalog } from "./catalog.js";

export const repository = "dion-nikila/Mobius-gallery";
export const studioOwner = "dion-nikila";
const branch = "main";
const api = "https://api.github.com";
const repoApi = `/repos/${repository}`;

async function request(token, path, method = "GET", payload) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(payload && { "Content-Type": "application/json" }),
    },
    body: payload && JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
    cache: "no-store",
    redirect: "error",
  });

  if (response.status === 401) throw new Error("Your GitHub session has expired. Reconnect to the studio.");
  if (response.status === 403 || response.status === 404) {
    throw new Error("GitHub denied access. Check that Studio has Contents read and write access to Mobius-gallery.");
  }
  if (!response.ok) throw new Error(`GitHub could not complete the operation (HTTP ${response.status}).`);
  return response.json();
}

async function readHead(token) {
  const ref = await request(token, `${repoApi}/git/ref/heads/${branch}`);
  return ref.object.sha;
}

async function readCatalog(token, head) {
  const file = await request(token, `${repoApi}/contents/${catalogPath}?ref=${head}`);
  const binary = atob(file.content);
  const text = new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  return { sha: file.sha, catalog: validateCatalog(JSON.parse(text)) };
}

export async function loadGitHubStudio(token) {
  const user = await request(token, "/user");
  if (user.login.toLowerCase() !== studioOwner) throw new Error("Use a token from the GitHub account that owns Mobius-gallery.");
  const head = await readHead(token);
  const { sha, catalog } = await readCatalog(token, head);
  return { head, catalogSha: sha, artworks: catalog.artworks };
}

export async function verifyStudioInstallation(token) {
  const { installations } = await request(token, "/user/installations?per_page=100");
  const installation = installations.find(({ account, permissions, suspended_at }) =>
    account?.login?.toLowerCase() === studioOwner && permissions?.contents === "write" && !suspended_at);
  if (!installation) throw new Error("Install the Studio GitHub App on the archive repository.");
  const { repositories } = await request(token, `/user/installations/${installation.id}/repositories?per_page=100`);
  if (!repositories.some(({ full_name }) => full_name.toLowerCase() === repository.toLowerCase())) {
    throw new Error("Grant the app access to Mobius-gallery.");
  }
}

function blobEntry(path, sha) {
  return { path, sha, mode: "100644", type: "blob" };
}

export async function stageGitHubImages(token, upload) {
  const assets = [];
  for (const content of [upload.image, upload.thumbnail]) {
    const blob = await request(token, `${repoApi}/git/blobs`, "POST", { content, encoding: "base64" });
    assets.push(blob.sha);
  }
  return { image: assets[0], thumbnail: assets[1] };
}

export async function publishGitHubCatalog(token, catalogSha, artworks, staged) {
  const catalog = validateCatalog({ schemaVersion: 1, artworks });
  const head = await readHead(token);
  const latest = await readCatalog(token, head);

  if (latest.sha !== catalogSha) {
    throw new Error("The live catalogue changed in another session. Copy any details you want to keep, then reload the published catalogue.");
  }

  const previous = new Map(latest.catalog.artworks.map((artwork) => [artwork.id, artwork]));
  const nextIds = new Set(artworks.map((artwork) => artwork.id));
  if ([...previous.keys()].some((id) => !nextIds.has(id))) {
    throw new Error("Use the visibility control to hide existing artwork.");
  }
  const tree = [];
  for (const artwork of artworks) {
    const pair = Object.hasOwn(staged, artwork.id) ? staged[artwork.id] : null;
    if (pair) {
      const image = `art/uploads/${artwork.id}.webp`;
      const thumbnail = `art/thumbnails/${artwork.id}.webp`;
      if (artwork.image !== image || artwork.thumbnail !== thumbnail) {
        throw new Error("Artwork paths do not match the staged images.");
      }
      tree.push(blobEntry(image, pair.image), blobEntry(thumbnail, pair.thumbnail));
    } else {
      const original = previous.get(artwork.id);
      if (artwork.image !== original?.image || artwork.thumbnail !== original?.thumbnail) {
        throw new Error(`Choose an image for “${artwork.title}” before publishing.`);
      }
    }
  }

  const parent = await request(token, `${repoApi}/git/commits/${head}`);
  const manifest = await request(token, `${repoApi}/git/blobs`, "POST", {
    content: `${JSON.stringify(catalog, null, 2)}\n`,
    encoding: "utf-8",
  });
  tree.push(blobEntry(catalogPath, manifest.sha));
  const nextTree = await request(token, `${repoApi}/git/trees`, "POST", { base_tree: parent.tree.sha, tree });
  const nextCommit = await request(token, `${repoApi}/git/commits`, "POST", {
    message: "Publish Chinese Satellite artwork catalogue",
    tree: nextTree.sha,
    parents: [head],
  });

  try {
    await request(token, `${repoApi}/git/refs/heads/${branch}`, "PATCH", { sha: nextCommit.sha, force: false });
  } catch (error) {
    // The connection may have dropped after GitHub applied the update.
    const current = await readHead(token).catch(() => "");
    if (current !== nextCommit.sha) throw error;
  }

  return { head: nextCommit.sha, catalogSha: manifest.sha, artworks };
}

export async function studioAuthStatus() {
  const response = await fetch("/api/studio-auth", { cache: "no-store" });
  if (!response.ok) return { enabled: false, signedIn: false };
  return response.json();
}

async function studioAction(action, payload = {}) {
  const response = await fetch("/api/studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(45000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Studio couldn’t finish that request. Please try again.");
  return result;
}

export function signOutStudio() {
  return studioAction("signOut");
}

export function loadStudio(token) {
  return token ? loadGitHubStudio(token) : studioAction("catalog");
}

export async function publishStudio(token, snapshot, artworks, uploads, report) {
  validateCatalog({ schemaVersion: 1, artworks });
  const staged = {};
  for (const artwork of artworks) {
    if (!Object.hasOwn(uploads, artwork.id)) continue;
    report(`Uploading ${artwork.title}…`);
    const { image, thumbnail } = uploads[artwork.id];
    staged[artwork.id] = token
      ? await stageGitHubImages(token, { image, thumbnail })
      : (await studioAction("stage", { id: artwork.id, image, thumbnail })).ticket;
  }

  report("Saving the catalogue…");
  return token
    ? publishGitHubCatalog(token, snapshot.catalogSha, artworks, staged)
    : studioAction("publish", { catalogSha: snapshot.catalogSha, artworks, staged });
}

export async function deploymentStatus(sha) {
  const result = await request(null, `${repoApi}/commits/${sha}/status`);
  return result.statuses.find((status) => /^vercel(?:\b|$)/i.test(status.context))?.state ?? "pending";
}

export function thumbnailUrl(head, path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${repository}/${head}/${encodedPath}`;
}
