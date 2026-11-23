import { useCallback, useEffect, useRef, useState } from "react";
import { availabilityOptions } from "./catalog.js";
import { deploymentStatus, loadStudio, publishStudio, repository, signOutStudio, studioAuthStatus, thumbnailUrl } from "./studioGitHub.js";
import { prepareImages } from "./studioImages.js";
import "./studio.css";

const tokenSettings = "https://github.com/settings/personal-access-tokens/new";
const visibilityFilters = { all: "All", visible: "Visible", hidden: "Hidden" };

function artworkTitle(artwork) {
  return artwork.title.trim() || "Untitled artwork";
}

function catalogueChanges(artworks, published, uploads) {
  const previous = new Map(published.map((artwork) => [artwork.id, artwork]));
  const entries = [];
  for (const artwork of artworks) {
    const original = previous.get(artwork.id);
    const actions = [];
    if (!original) {
      actions.push(artwork.visible ? "Add to gallery" : "Add as hidden");
    } else {
      const { visible, ...details } = artwork;
      const { visible: wasVisible, ...originalDetails } = original;
      if (visible !== wasVisible) actions.push(visible ? "Show in gallery" : "Hide from gallery");
      if (JSON.stringify(details) !== JSON.stringify(originalDetails) || uploads[artwork.id]) actions.push("Update artwork");
    }
    if (actions.length) entries.push({ artwork, actions });
  }
  const orderChanged = artworks.filter((artwork) => previous.has(artwork.id))
    .some((artwork, index) => artwork.id !== published[index]?.id);
  return { entries, orderChanged };
}

function fileSize(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function StudioLogin({ onConnect, busy, error, authEnabled }) {
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
      <div className="studio-panel studio-signin">
        {authEnabled === null ? (
          <p role="status">Checking sign-in…</p>
        ) : authEnabled ? (
          <a className="studio-primary studio-login-link" href="/api/studio-auth?action=start">Sign in with GitHub</a>
        ) : (
          <p>GitHub sign-in is awaiting activation for this site.</p>
        )}
        {error && <p className="studio-error" role="alert">{error}</p>}
        <details>
          <summary>Use a GitHub token instead</summary>
          <form onSubmit={submit}>
            <p>Use a <a href={tokenSettings} target="_blank" rel="noreferrer">fine-grained token</a> from <strong>dion-nikila</strong> with Contents read and write access to <strong>Mobius-gallery</strong>.</p>
            <label className="studio-field">
              GitHub access token
              <input type="password" autoComplete="off" spellCheck={false} value={token}
                onChange={(event) => setToken(event.target.value)} required placeholder="github_pat_…" />
            </label>
            <button type="submit" className="studio-secondary" disabled={busy}>{busy ? "Connecting…" : "Connect with token"}</button>
          </form>
        </details>
      </div>
    </div>
  );
}

function ArtworkEditor({ artwork, preview, upload, blocked, preparing, onChange, onUpload, onDiscard, onMove, onVisibility, canHide, canMoveUp, canMoveDown, headingRef }) {
  return (
    <section className="studio-panel studio-editor" aria-labelledby="studio-edit-title">
      <div className="studio-editor-heading">
        <h2 id="studio-edit-title" ref={headingRef} tabIndex={-1}>{artworkTitle(artwork)}</h2>
        <span className="studio-visibility" data-visible={artwork.visible}>{artwork.visible ? "Visible" : "Hidden"}</span>
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
          <div className="studio-presentation">
            <h3>Display on the site</h3>
            <div className="studio-editor-actions">
              <button type="button" className="studio-secondary" onClick={onVisibility} disabled={artwork.visible && !canHide}>
                {artwork.visible ? "Hide from gallery" : "Show in gallery"}
              </button>
              <label className="studio-feature">
                <input type="checkbox" checked={artwork.featured} onChange={(event) => onChange({ featured: event.target.checked })} /> Feature on About
              </label>
            </div>
            <p className="studio-help">{artwork.visible && !canHide
              ? "Keep at least one artwork visible in the gallery."
              : "Hide removes this piece from the public gallery and About after you publish."}</p>
            <div className="studio-editor-actions">
              <button type="button" className="studio-secondary" disabled={!canMoveUp} onClick={() => onMove(0, true)}>Move to top</button>
              <button type="button" className="studio-secondary" disabled={!canMoveUp} onClick={() => onMove(-1)}>Move earlier</button>
              <button type="button" className="studio-secondary" disabled={!canMoveDown} onClick={() => onMove(1)}>Move later</button>
              {onDiscard && <button type="button" className="studio-secondary" onClick={onDiscard}>Discard new piece</button>}
            </div>
          </div>
        </fieldset>
      </div>
    </section>
  );
}

export default function StudioPage() {
  const [session, setSession] = useState(null);
  const [authEnabled, setAuthEnabled] = useState(null);
  const [artworks, setArtworks] = useState([]);
  const [uploads, setUploads] = useState({});
  const [selection, setSelection] = useState("");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState("all");
  const [busy, setBusy] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState(() => {
    const code = new URLSearchParams(window.location.hash.split("?")[1]).get("auth");
    if (code === "access") return "Sign in as dion-nikila and check that the GitHub App has access to Mobius-gallery.";
    if (code === "retry") return "Sign-in didn’t complete. Please try again.";
    return "";
  });
  const [deployment, setDeployment] = useState(null);
  const action = useRef(false);
  const editorHeading = useRef(null);
  const openEditor = useRef(false);
  const reviewButton = useRef(null);
  const selectedIndex = artworks.findIndex((artwork) => artwork.id === selection);
  const selected = artworks[selectedIndex];
  const { entries, orderChanged } = catalogueChanges(artworks, session?.snapshot.artworks ?? [], uploads);
  const changed = entries.length > 0 || orderChanged;
  const visibleCount = artworks.filter((artwork) => artwork.visible).length;
  const counts = { all: artworks.length, visible: visibleCount, hidden: artworks.length - visibleCount };
  const missingDetails = entries.map(({ artwork }) => artwork).filter((artwork) => !artwork.title.trim() || !artwork.image);
  const blocked = Boolean(busy) || imageLoading || authEnabled === null;

  useEffect(() => {
    if (!openEditor.current || !editorHeading.current) return;
    openEditor.current = false;
    editorHeading.current.focus();
  }, [selection]);

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

  const setSnapshot = useCallback((token, snapshot) => {
    setSession({ token, snapshot });
    setArtworks(snapshot.artworks);
    setSelection(snapshot.artworks[0]?.id ?? "");
    setUploads({});
    setReviewOpen(false);
  }, []);

  useEffect(() => {
    let stopped = false;
    async function restore() {
      try {
        const status = await studioAuthStatus().catch(() => ({ enabled: false, signedIn: false }));
        if (stopped) return;
        if (status.enabled && status.signedIn) {
          const snapshot = await loadStudio(null);
          if (!stopped) setSnapshot(null, snapshot);
        }
        if (!stopped) setAuthEnabled(Boolean(status.enabled));
      } catch (err) {
        if (!stopped) {
          setAuthEnabled(true);
          setError(err.message);
        }
      }
    }
    restore();
    return () => { stopped = true; };
  }, [setSnapshot]);

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

  async function leave(archive) {
    if (action.current || (changed && !window.confirm("Discard unpublished changes?"))) return;
    if (!archive && session && !session.token) {
      action.current = true;
      setBusy("Signing out…");
      try {
        await signOutStudio();
      } catch (err) {
        setError(err.message);
        return;
      } finally {
        action.current = false;
        setBusy("");
      }
    }
    setSession(null);
    setArtworks([]);
    setUploads({});
    setSearch("");
    setShow("all");
    setReviewOpen(false);
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
    editArtwork(id);
    setSearch("");
    setShow("all");
  }

  function update(id, fields) {
    setArtworks((current) => current.map((artwork) => artwork.id === id ? { ...artwork, ...fields } : artwork));
  }

  function editArtwork(id) {
    if (id === selection) {
      editorHeading.current?.focus();
      return;
    }
    openEditor.current = true;
    setSelection(id);
  }

  function toggleVisibility(artwork) {
    if (blocked || (artwork.visible && visibleCount <= 1)) return;
    update(artwork.id, { visible: !artwork.visible });
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

  function move(direction, toTop = false) {
    setArtworks((current) => {
      const from = current.findIndex((item) => item.id === selection);
      const to = toTop ? 0 : from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      next.splice(to, 0, ...next.splice(from, 1));
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
    if (!changed || missingDetails.length || !visibleCount || blocked || action.current) return;
    action.current = true;
    setError("");
    setBusy("Checking the catalogue…");
    try {
      const clean = artworks.map((artwork) => ({ ...artwork, title: artwork.title.trim() }));
      const snapshot = await publishStudio(session.token, session.snapshot, clean, uploads, setBusy);
      setSession({ token: session.token, snapshot });
      setArtworks(snapshot.artworks);
      setUploads({});
      setReviewOpen(false);
      setDeployment({ sha: snapshot.head, state: "pending" });
    } catch (err) {
      setError(err.message);
    } finally {
      action.current = false;
      setBusy("");
    }
  }

  function previewFor(artwork, fullSize = false) {
    const path = fullSize ? artwork.image : artwork.thumbnail;
    return uploads[artwork.id]?.preview || (path && thumbnailUrl(session.snapshot.head, path));
  }

  const query = search.trim().toLowerCase();
  const results = artworks.filter((artwork) => {
    const match = `${artworkTitle(artwork)} ${artwork.year ?? ""} ${artwork.medium ?? ""}`.toLowerCase().includes(query);
    return match && (show === "all" || artwork.visible === (show === "visible"));
  });

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
          <StudioLogin onConnect={connect} error={error} busy={blocked} authEnabled={authEnabled} />
        ) : (
          <>
            <div className="studio-title">
              <div><h1>Artwork studio</h1><p>Manage the artwork shown in your archive.</p></div>
              <div className="studio-title-actions">
                <button className="studio-secondary" type="button" onClick={createArtwork} disabled={blocked}>Add artwork</button>
                <button className="studio-primary" type="button" ref={reviewButton} aria-expanded={reviewOpen && changed}
                  onClick={() => setReviewOpen(!reviewOpen || !changed)} disabled={!changed || blocked}>Review changes</button>
              </div>
            </div>
            <div className="studio-status" aria-live="polite">
              {busy || (imageLoading ? "Preparing image…" : changed ? "Unpublished changes" : "No unpublished changes")}
              {deployment && (
                <p>{releaseMessage[deployment.state] ?? releaseMessage.unconfirmed} <a href={`https://github.com/${repository}/commit/${deployment.sha}`} target="_blank" rel="noreferrer">View commit</a></p>
              )}
            </div>
            {error && <p className="studio-error" role="alert">{error}</p>}
            {reviewOpen && changed && (
              <section className="studio-panel studio-review" aria-labelledby="studio-review-title">
                <h2 id="studio-review-title">Review changes</h2>
                <p>Changes appear on the site after publishing and deployment.</p>
                <ul>
                  {entries.map(({ artwork, actions }) => (
                    <li key={artwork.id}><strong>{artworkTitle(artwork)}</strong><span>{actions.join(" · ")}</span></li>
                  ))}
                  {orderChanged && <li>Gallery order changed</li>}
                </ul>
                {missingDetails.length > 0 && (
                  <div className="studio-review-missing">
                    <p>Add a title and image to finish these pieces.</p>
                    {missingDetails.map((artwork) => (
                      <button className="studio-secondary" type="button" key={artwork.id} disabled={blocked}
                        onClick={() => editArtwork(artwork.id)}>Edit {artworkTitle(artwork)}</button>
                    ))}
                  </div>
                )}
                {!visibleCount && <p className="studio-error">Show at least one artwork in the gallery before publishing.</p>}
                <div className="studio-editor-actions">
                  <button className="studio-primary" type="button" onClick={publish} disabled={blocked || missingDetails.length > 0 || !visibleCount}>Publish changes</button>
                  <button className="studio-secondary" type="button" onClick={() => { setReviewOpen(false); reviewButton.current?.focus(); }}>Keep editing</button>
                </div>
              </section>
            )}
            <div className="studio-workspace">
              <section className="studio-panel studio-library" aria-label="Artwork catalogue">
                <h2>Catalogue</h2>
                <label className="studio-field">Search artwork<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title, year, or medium" /></label>
                <div className="studio-filters" role="group" aria-label="Filter by visibility">
                  {Object.entries(visibilityFilters).map(([value, label]) => (
                    <button type="button" key={value} aria-pressed={show === value} onClick={() => setShow(value)}>
                      {label} <span>{counts[value]}</span>
                    </button>
                  ))}
                </div>
                <div className="studio-list">
                  {!results.length && <p className="studio-help">{query ? "No artwork matches your search." : `No ${visibilityFilters[show].toLowerCase()} artwork.`}</p>}
                  {results.map((artwork) => (
                    <div className="studio-item-row" key={artwork.id}>
                      <button type="button" className="studio-item" aria-pressed={selection === artwork.id}
                        onClick={() => editArtwork(artwork.id)} disabled={blocked}>
                        {previewFor(artwork) ? <img src={previewFor(artwork)} alt="" loading="lazy" /> : <span className="studio-empty-thumbnail" />}
                        <span>
                          <strong>{artworkTitle(artwork)}</strong>
                          <small className="studio-visibility" data-visible={artwork.visible}>{artwork.visible ? "Visible" : "Hidden"}{artwork.featured && artwork.visible ? " · About" : ""}</small>
                        </span>
                      </button>
                      <button className="studio-quick-action" type="button" onClick={() => toggleVisibility(artwork)}
                        aria-label={`${artwork.visible ? "Hide" : "Show"} ${artworkTitle(artwork)}`}
                        disabled={blocked || (artwork.visible && visibleCount <= 1)}>{artwork.visible ? "Hide" : "Show"}</button>
                    </div>
                  ))}
                </div>
                <p className="studio-help" aria-live="polite">{results.length} of {artworks.length} shown</p>
              </section>
              {selected && <ArtworkEditor artwork={selected} preview={previewFor(selected, true)} upload={uploads[selected.id]}
                blocked={blocked} preparing={imageLoading}
                onChange={(fields) => update(selected.id, fields)} onUpload={upload} onMove={move}
                onVisibility={() => toggleVisibility(selected)} canHide={visibleCount > 1} headingRef={editorHeading}
                canMoveUp={selectedIndex > 0} canMoveDown={selectedIndex < artworks.length - 1}
                onDiscard={session.snapshot.artworks.some((item) => item.id === selected.id) ? undefined : discardNew} />}
            </div>
            <details className="studio-display-help">
              <summary>How artwork appears on the site</summary>
              <p className="studio-help">The landing gallery shows the first 16 visible pieces. About gives priority to the first four visible pieces marked Feature on About. Hidden pieces stay in Studio and their image files stay in the public repository.</p>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
