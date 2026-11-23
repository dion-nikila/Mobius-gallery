import { useEffect, useRef, useState } from "react";
import { availabilityOptions } from "./catalog.js";
import { deploymentStatus, loadStudio, publishStudio, repository, thumbnailUrl } from "./studioGitHub.js";
import { prepareImages } from "./studioImages.js";
import "./studio.css";

const tokenSettings = "https://github.com/settings/personal-access-tokens/new";

function fileSize(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function StudioLogin({ onConnect, busy, error }) {
  const [token, setToken] = useState("");

  function submit(event) {
    event.preventDefault();
    const credential = token.trim();
    setToken("");
    onConnect(credential);
  }

  return (
    <div className="studio-login">
      <div>
        <h1>Artwork studio</h1>
        <p>Upload pieces and manage what appears in the archive.</p>
      </div>
      <form className="studio-panel" onSubmit={submit}>
        <label className="studio-field">
          GitHub access token
          <input type="password" autoComplete="off" spellCheck={false} value={token}
            onChange={(event) => setToken(event.target.value)} required placeholder="github_pat_…" />
        </label>
        <button type="submit" className="studio-primary" disabled={busy}>{busy ? "Connecting…" : "Connect to the archive"}</button>
        {error && <p className="studio-error" role="alert">{error}</p>}
        <details>
          <summary>Set up studio access</summary>
          <p>Create a <a href={tokenSettings} target="_blank" rel="noreferrer">fine-grained GitHub token</a> from <strong>dion-nikila</strong>. Select only <strong>Mobius-gallery</strong>, give <strong>Contents</strong> read and write access, and choose an expiration date.</p>
          <p>The token is used only for this session. Store it in your password manager if you want to reuse it.</p>
        </details>
      </form>
    </div>
  );
}

function ArtworkEditor({ artwork, preview, upload, blocked, preparing, onChange, onUpload, onDiscard, onMove, canMoveUp, canMoveDown }) {
  return (
    <section className="studio-panel studio-editor" aria-label="Edit artwork">
      <div className="studio-editor-heading">
        <h2>{artwork.title || "New artwork"}</h2>
        {!artwork.visible && <span>Hidden</span>}
      </div>
      <div className="studio-editor-layout">
        <div>
          <div className="studio-preview">
            {preview ? <img src={preview} alt={artwork.alt || artwork.title || "Artwork preview"} /> : <p>Choose an image to preview it here.</p>}
          </div>
          <label className="studio-field studio-file">
            {preview ? "Replace image" : "Choose an image"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={blocked}
              onChange={(event) => {
                const file = event.target.files[0];
                event.target.value = "";
                if (file) onUpload(file);
              }} />
          </label>
          <p className="studio-help">{preparing ? "Preparing web image and thumbnail…" : upload ? `Optimized upload · ${fileSize(upload.bytes)}` : "JPG, PNG, WebP, or AVIF. Up to 24 MB."}</p>
        </div>
        <fieldset className="studio-edit-fields" disabled={blocked}>
          <label className="studio-field">
            Title
            <input value={artwork.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={120} />
          </label>
          <div className="studio-field-row">
            <label className="studio-field">
              Year
              <input value={artwork.year ?? ""} placeholder="2026" maxLength={20} onChange={(event) => onChange({ year: event.target.value })} />
            </label>
            <label className="studio-field">
              Availability
              <select value={artwork.availability} onChange={(event) => onChange({ availability: event.target.value })}>
                {Object.entries(availabilityOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="studio-field">
            Medium
            <input value={artwork.medium ?? ""} placeholder="Watercolor and fineliner on paper" maxLength={150}
              onChange={(event) => onChange({ medium: event.target.value })} />
          </label>
          <label className="studio-field">
            Notes for the artwork page <span>(optional)</span>
            <textarea rows={3} value={artwork.description ?? ""} maxLength={500}
              onChange={(event) => onChange({ description: event.target.value })} />
          </label>
          <label className="studio-field">
            Image description <span>(optional)</span>
            <input value={artwork.alt ?? ""} maxLength={200} placeholder="Describe the image for screen readers"
              onChange={(event) => onChange({ alt: event.target.value })} />
          </label>
          <div className="studio-checks">
            <label><input type="checkbox" checked={artwork.visible}
              onChange={(event) => onChange({ visible: event.target.checked })} /> Show in gallery</label>
            <label><input type="checkbox" checked={artwork.featured}
              onChange={(event) => onChange({ featured: event.target.checked })} /> Feature on About</label>
          </div>
          <div className="studio-editor-actions">
            <button type="button" className="studio-secondary" disabled={!canMoveUp} onClick={() => onMove(-1)}>Move earlier</button>
            <button type="button" className="studio-secondary" disabled={!canMoveDown} onClick={() => onMove(1)}>Move later</button>
            {onDiscard && <button type="button" className="studio-secondary" onClick={onDiscard}>Discard new piece</button>}
          </div>
        </fieldset>
      </div>
    </section>
  );
}

export default function StudioPage() {
  const [session, setSession] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [uploads, setUploads] = useState({});
  const [selection, setSelection] = useState("");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("all");
  const [busy, setBusy] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState("");
  const [deployment, setDeployment] = useState(null);
  const action = useRef(false);
  const selectedIndex = artworks.findIndex((artwork) => artwork.id === selection);
  const selected = artworks[selectedIndex];
  const changed = session && (JSON.stringify(artworks) !== JSON.stringify(session.snapshot.artworks) || Object.keys(uploads).length > 0);
  const blocked = Boolean(busy) || imageLoading;

  useEffect(() => {
    if (!changed && !busy && !imageLoading) return;
    function warn(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed, busy, imageLoading]);

  const deployingSha = deployment?.state === "pending" ? deployment.sha : null;
  useEffect(() => {
    if (!deployingSha) return;
    let stopped = false;
    let timer;
    const deadline = Date.now() + 115000;

    async function poll() {
      const state = await deploymentStatus(deployingSha).catch(() => "pending");
      if (stopped) return;
      if (state === "pending" && Date.now() < deadline) {
        timer = setTimeout(poll, 6500);
      } else {
        setDeployment({ sha: deployingSha, state: state === "pending" ? "unconfirmed" : state });
      }
    }
    timer = setTimeout(poll, 3500);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [deployingSha]);

  function setSnapshot(token, snapshot) {
    setSession({ token, snapshot });
    setArtworks(snapshot.artworks);
    setSelection(snapshot.artworks[0]?.id ?? "");
    setUploads({});
  }

  async function connect(token) {
    if (action.current) return;
    if (!token.startsWith("github_pat_")) {
      setError("Use a fine-grained GitHub token that starts with github_pat_.");
      return;
    }
    action.current = true;
    setBusy("Connecting…");
    setError("");
    try {
      setSnapshot(token, await loadStudio(token));
    } catch (err) {
      setError(err.message);
    } finally {
      action.current = false;
      setBusy("");
    }
  }

  function leave(archive) {
    if (changed && !window.confirm("Discard unpublished changes?")) return;
    setSession(null);
    setArtworks([]);
    setUploads({});
    setSearch("");
    setShow("all");
    setDeployment(null);
    setError("");
    if (archive) window.location.hash = "#/";
  }

  function createArtwork() {
    const id = crypto.randomUUID();
    setArtworks((current) => [{
      id, title: "", image: "", thumbnail: "", year: "", medium: "",
      visible: true, featured: false, availability: "inquire",
    }, ...current]);
    setSelection(id);
    setSearch("");
    setShow("all");
  }

  function update(id, fields) {
    setArtworks((current) => current.map((artwork) => artwork.id === id ? { ...artwork, ...fields } : artwork));
  }

  async function upload(file) {
    if (!selected || blocked) return;
    const id = selected.id;
    setImageLoading(true);
    setError("");
    try {
      const image = await prepareImages(file);
      setUploads((current) => ({ ...current, [id]: image }));
      update(id, {
        image: `art/uploads/${id}.webp`,
        thumbnail: `art/thumbnails/${id}.webp`,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setImageLoading(false);
    }
  }

  function move(direction) {
    setArtworks((current) => {
      const from = current.findIndex((item) => item.id === selection);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[to], next[from]] = [next[from], next[to]];
      return next;
    });
  }

  function discardNew() {
    setArtworks((current) => current.filter((item) => item.id !== selection));
    setUploads((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== selection)));
    setSelection(artworks.find((item) => item.id !== selection)?.id ?? "");
  }

  async function reloadCatalog() {
    if (blocked || action.current || (changed && !window.confirm("Reload the published catalogue and discard unpublished changes?"))) return;
    action.current = true;
    setBusy("Reloading…");
    setError("");
    try {
      setSnapshot(session.token, await loadStudio(session.token));
    } catch (err) {
      setError(err.message);
    } finally {
      action.current = false;
      setBusy("");
    }
  }

  async function publish() {
    if (!changed || blocked || action.current) return;
    action.current = true;
    setError("");
    setBusy("Checking the catalogue…");
    try {
      const clean = artworks.map((artwork) => ({ ...artwork, title: artwork.title.trim() }));
      const snapshot = await publishStudio(session.token, session.snapshot, clean, uploads, setBusy);
      setSession({ token: session.token, snapshot });
      setArtworks(snapshot.artworks);
      setUploads({});
      setDeployment({ sha: snapshot.head, state: "pending" });
    } catch (err) {
      setError(err.message);
    } finally {
      action.current = false;
      setBusy("");
    }
  }

  function previewFor(artwork) {
    return uploads[artwork.id]?.preview || (artwork.thumbnail && thumbnailUrl(session.snapshot.head, artwork.thumbnail));
  }

  const releaseMessage = {
    pending: "Saved to GitHub. Waiting for Vercel.",
    success: "Published. Vercel confirmed the deployment.",
    error: "Saved to GitHub. Vercel reported a deployment error.",
    failure: "Saved to GitHub. Vercel reported a deployment failure.",
    unconfirmed: "Saved to GitHub. Vercel’s deployment is still unconfirmed.",
  };

  return (
    <main className="studio-page">
      <div className="studio-inner">
        <header className="studio-top">
          <button type="button" disabled={blocked} onClick={() => leave(true)}>The Chinese Satellite Archive</button>
          {session && <div className="studio-title-actions">
            <button type="button" disabled={blocked} onClick={reloadCatalog}>Reload catalogue</button>
            <button type="button" disabled={blocked} onClick={() => leave(false)}>Disconnect</button>
          </div>}
        </header>
        {!session ? (
          <StudioLogin onConnect={connect} error={error} busy={Boolean(busy)} />
        ) : (
          <>
            <div className="studio-title">
              <div><h1>Artwork studio</h1><p>{artworks.filter((item) => item.visible).length} visible · {artworks.filter((item) => !item.visible).length} hidden</p></div>
              <div className="studio-title-actions">
                <button className="studio-secondary" type="button" onClick={createArtwork} disabled={blocked}>Add artwork</button>
                <button className="studio-primary" type="button" onClick={publish} disabled={!changed || blocked}>Publish changes</button>
              </div>
            </div>
            <div className="studio-status" aria-live="polite">
              {busy || (imageLoading ? "Preparing image…" : changed ? "Unpublished changes" : "No unpublished changes")}
              {deployment && (
                <p>{releaseMessage[deployment.state] ?? releaseMessage.unconfirmed} <a href={`https://github.com/${repository}/commit/${deployment.sha}`} target="_blank" rel="noreferrer">View commit</a></p>
              )}
            </div>
            {error && <p className="studio-error" role="alert">{error}</p>}
            <div className="studio-workspace">
              <section className="studio-panel studio-library" aria-label="Artwork catalogue">
                <label className="studio-field">Search artwork<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, year, or medium" /></label>
                <label className="studio-field">Visibility
                  <select value={show} onChange={(event) => setShow(event.target.value)}>
                    <option value="all">All artwork</option>
                    <option value="visible">Visible only</option>
                    <option value="hidden">Hidden only</option>
                  </select>
                </label>
                <div className="studio-list">
                  {artworks.filter((artwork) => {
                    const match = `${artwork.title} ${artwork.year ?? ""} ${artwork.medium ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
                    return match && (show === "all" || artwork.visible === (show === "visible"));
                  }).map((artwork) => (
                    <button type="button" className="studio-item" key={artwork.id} aria-pressed={selection === artwork.id}
                      onClick={() => setSelection(artwork.id)} disabled={blocked}>
                      {previewFor(artwork) ? <img src={previewFor(artwork)} alt="" loading="lazy" /> : <span className="studio-empty-thumbnail" />}
                      <span><strong>{artwork.title || "Untitled artwork"}</strong><small>{artwork.visible ? "Visible" : "Hidden"}{artwork.featured ? " · About" : ""}</small></span>
                    </button>
                  ))}
                </div>
              </section>
              {selected && <ArtworkEditor artwork={selected} preview={previewFor(selected)} upload={uploads[selected.id]}
                blocked={blocked} preparing={imageLoading}
                onChange={(fields) => update(selected.id, fields)} onUpload={upload} onMove={move}
                canMoveUp={selectedIndex > 0} canMoveDown={selectedIndex < artworks.length - 1}
                onDiscard={session.snapshot.artworks.some((item) => item.id === selected.id) ? undefined : discardNew} />}
            </div>
            <p className="studio-help">The landing gallery uses the first 16 visible pieces. About uses up to four featured pieces in catalogue order. Hidden pieces stay in the public repository. Keep private work on your device.</p>
          </>
        )}
      </div>
    </main>
  );
}
