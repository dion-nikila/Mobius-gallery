export const catalogPath = "art/catalog.json";
export const availabilityOptions = {
  inquire: "Inquire",
  available: "Available",
  unavailable: "Unavailable",
};
const artworkPath = /^art\/(?:uploads\/|thumbnails\/)?[^/\\\r\n]+\.(?:avif|gif|jpe?g|png|webp)$/i;
const limits = { title: 120, year: 20, medium: 150, description: 500, alt: 200, legacyTitle: 120 };

export function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.artworks)) {
    throw new Error("This catalogue format is unsupported.");
  }
  const ids = new Set();
  for (const artwork of catalog.artworks) {
    if (!artwork || typeof artwork.id !== "string" || !/^[a-z0-9-]{1,100}$/.test(artwork.id) || ids.has(artwork.id)) {
      throw new Error("Every artwork must have a unique ID.");
    }
    ids.add(artwork.id);
    if (typeof artwork.title !== "string" || !artwork.title.trim() || ![artwork.image, artwork.thumbnail].every((path) => typeof path === "string" && artworkPath.test(path))) {
      throw new Error("Every artwork needs a title, a web image, and a thumbnail.");
    }
    for (const [key, max] of Object.entries(limits)) {
      const value = artwork[key];
      if (value !== undefined && (typeof value !== "string" || value.length > max)) {
        throw new Error(`Check the ${key} for “${artwork.title}”.`);
      }
    }
    if (typeof artwork.visible !== "boolean" || typeof artwork.featured !== "boolean" || !Object.hasOwn(availabilityOptions, artwork.availability)) {
      throw new Error(`Check visibility and availability for “${artwork.title}”.`);
    }
  }
  if (!catalog.artworks.some((artwork) => artwork.visible)) {
    throw new Error("Keep at least one artwork visible in the gallery.");
  }
  return catalog;
}

export function resolveArtworkReference(artworks, reference) {
  if (!reference) return undefined;
  return artworks.find(({ id, title, legacyTitle }) => reference === id || reference === title || reference === legacyTitle);
}
