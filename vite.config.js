import { readFileSync, existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { catalogPath, validateCatalog } from './src/catalog.js'

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "validate-artwork-catalogue",
      buildStart() {
        const catalog = validateCatalog(JSON.parse(readFileSync(new URL(catalogPath, import.meta.url), "utf8")));
        for (const work of catalog.artworks) {
          for (const path of [work.image, work.thumbnail]) {
            if (!existsSync(new URL(encodeURI(path).replace(/#/g, "%23").replace(/\?/g, "%3F"), import.meta.url))) {
              this.error(`Artwork asset missing for “${work.title}”: ${path}`);
            }
          }
        }
      },
    },
  ],
})
