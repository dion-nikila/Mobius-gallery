import catalog from "../art/catalog.json";
import { validateCatalog } from "./catalog.js";

const imageUrls = import.meta.glob("../art/**/*.{avif,gif,jpeg,jpg,png,webp}", {
  eager: true,
  import: "default",
  query: "?url",
});

export const artworks = validateCatalog(catalog).artworks.filter((work) => work.visible).map((work) => ({
  ...work,
  image: imageUrls[`../${work.image}`],
  thumbnail: imageUrls[`../${work.thumbnail}`],
}));

const featured = artworks.filter((work) => work.featured);
export const aboutArtworks = [...featured, ...artworks.filter((work) => !work.featured)].slice(0, 4);
