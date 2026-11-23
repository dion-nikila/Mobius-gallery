import { catalogPath, validateCatalog } from "./catalog.js";

export const repository = "dion-nikila/Mobius-gallery";
const owner = "dion-nikila";
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
  });

  if (response.status === 401) throw new Error("This GitHub token is invalid or expired. Disconnect and reconnect with a valid token.");
  if (response.status === 403 || response.status === 404) {
    throw new Error("GitHub denied access. Check that your token can read and write Contents in Mobius-gallery and that it has not reached a rate limit.");
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

export async function loadStudio(token) {
  const user = await request(token, "/user");
  if (user.login.toLowerCase() !== owner) throw new Error("Use a token from the GitHub account that owns Mobius-gallery.");
  const head = await readHead(token);
  const { sha, catalog } = await readCatalog(token, head);
  return { head, catalogSha: sha, artworks: catalog.artworks };
}

function blobEntry(path, sha) {
  return { path, sha, mode: "100644", type: "blob" };
}

export async function publishStudio(token, snapshot, artworks, uploads, report) {
  const catalog = validateCatalog({ schemaVersion: 1, artworks });
  const head = await readHead(token);
  const latest = await readCatalog(token, head);

  if (latest.sha !== snapshot.catalogSha) {
    throw new Error("The live catalogue changed in another session. Your edits are still here. Copy any details you want to keep, then reload the published catalogue.");
  }

  const parent = await request(token, `${repoApi}/git/commits/${head}`);
  const tree = [];
  const activeUploads = artworks.filter((artwork) => uploads[artwork.id]);
  for (const artwork of activeUploads) {
    report(`Uploading ${artwork.title}…`);
    const upload = uploads[artwork.id];
    for (const [path, content] of [[artwork.image, upload.image], [artwork.thumbnail, upload.thumbnail]]) {
      const blob = await request(token, `${repoApi}/git/blobs`, "POST", { content, encoding: "base64" });
      tree.push(blobEntry(path, blob.sha));
    }
  }

  report("Saving the catalogue…");
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

export async function deploymentStatus(sha) {
  const result = await request(null, `${repoApi}/commits/${sha}/status`);
  return result.statuses.find((status) => /^vercel(?:\b|$)/i.test(status.context))?.state ?? "pending";
}

export function thumbnailUrl(head, path) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${repository}/${head}/${encodedPath}`;
}
