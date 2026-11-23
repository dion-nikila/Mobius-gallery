import { loadGitHubStudio, studioOwner, verifyStudioInstallation } from "../src/studioGitHub.js";
import {
  authConfig, callbackUrl, challenge, cookieValue, oauthCookie, seal, secret, secureEquals,
  sessionCookie, sessionFor, setCookie, studioHeaders, studioJson, studioOrigin, studioUrl, unseal,
} from "../server/studio-auth.js";

const githubAuthorize = "https://github.com/login/oauth/authorize";
const githubExchange = "https://github.com/login/oauth/access_token";

function redirect(location, cookies = []) {
  const headers = studioHeaders();
  headers.set("Location", location);
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function begin(config) {
  const state = secret();
  const verifier = secret();
  const proof = seal(config.key, oauthCookie, { state, verifier, expires: Date.now() + 600_000 });
  const url = new URL(githubAuthorize);
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: callbackUrl, state,
    code_challenge: challenge(verifier), code_challenge_method: "S256",
    login: studioOwner, allow_signup: "false",
  }).toString();
  return redirect(url.href, [setCookie(oauthCookie, proof, 600)]);
}

async function finish(request, config, params) {
  const clear = setCookie(oauthCookie);
  const fail = (reason) => redirect(`${studioUrl}?auth=${reason}`, [clear]);
  const proof = unseal(config.key, oauthCookie, cookieValue(request, oauthCookie));
  const code = params.get("code");
  if (!proof || !secureEquals(proof.state, params.get("state")) || !code || code.length > 256) return fail("retry");

  try {
    const response = await fetch(githubExchange, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId, client_secret: config.clientSecret,
        code, redirect_uri: callbackUrl, code_verifier: proof.verifier,
      }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!response.ok) return fail("retry");
    const grant = await response.json();
    if (typeof grant.access_token !== "string" || !grant.access_token.startsWith("ghu_")
      || grant.access_token.length > 256 || !Number.isInteger(grant.expires_in) || grant.expires_in < 120) return fail("retry");

    // Verify the owner and the installation's access before signing the browser in.
    await loadGitHubStudio(grant.access_token);
    await verifyStudioInstallation(grant.access_token);
    const lifetime = Math.min(grant.expires_in - 60, 7 * 3600);
    const session = seal(config.key, sessionCookie, {
      token: grant.access_token, id: secret(), expires: Date.now() + lifetime * 1000,
    });
    return redirect(studioUrl, [clear, setCookie(sessionCookie, session, lifetime)]);
  } catch {
    return fail("access");
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET") return studioJson({ error: "Method not allowed." }, 405);
    const config = url.origin === studioOrigin ? authConfig() : null;
    if (url.searchParams.get("action") === "start") {
      return config ? begin(config) : redirect(`${studioUrl}?auth=setup`);
    }
    if (config && (url.searchParams.has("code") || url.searchParams.has("error"))) {
      return finish(request, config, url.searchParams);
    }
    return studioJson({ enabled: Boolean(config), signedIn: Boolean(sessionFor(request, config)) });
  },
};
