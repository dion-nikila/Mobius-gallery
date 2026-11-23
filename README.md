# The Chinese Satellite Archive

Dion Nikila’s illustration portfolio and commission studio. The home page opens on the full-screen 3D Möbius gallery. Mobile devices and browsers without WebGL use the original interactive SVG strip. Buyers can request a commission or ask about an existing piece directly on the site.

## Run and build

Use Node.js 22.12+ or Node.js 24.

```sh
npm ci
npm run dev
npm run lint
npm run build
npm run preview
```

The Vercel project is `mobius-gallery`. Build with `npm run build` and serve `dist/`. Navigation uses hash links and relative assets, so a subdirectory works without server rewrite rules. Test the live home page and a direct `#/commissions` link before sharing the site.

## Handle requests

Starting prices, contact details, and the request template live in `src/commissions.js`. The one-step inquiry form submits to FormSubmit, which delivers the request and reply address to the configured inbox. A new recipient must activate the service via its first email. Before promoting the build, submit a real test from the deployed URL and verify that it arrives. The Contact button opens direct links for Instagram, WhatsApp, and email, along with a general inquiry form. Confirm scope, price, deadline, delivery, usage rights, and cancellation terms before requesting a deposit. Verify receipt of the deposit and final balance in your own payment account.

For existing pieces, confirm availability, format, rights, shipping, and price individually before accepting a payment. For international commissions, confirm a working payment method in the quote. Card checkout can be added once an approved merchant account is in place.

## Manage artwork in Studio

Open [the studio](https://chinesesatellite.art/#/studio). Create a fine-grained access token in your GitHub account. Select only `dion-nikila/Mobius-gallery` and grant **Contents: Read and write**. Use an expiration date and store the token in a password manager. Enter it exclusively on the archive’s Studio page. The browser keeps it in memory until you disconnect or reload.

1. Choose **Add artwork**, attach a JPG, PNG, WebP, or AVIF, and enter a title. Optionally add year, medium, availability, a viewer note, and an image description.
2. Use **Move earlier** and **Move later** to set the gallery order. The landing gallery uses the first 16 visible pieces, and the archive lists them all. About uses up to four featured pieces in that order. **Show in gallery** controls public visibility.
3. Review the image preview, then use **Publish changes** to send the entire batch to GitHub. Studio shows the Vercel deployment status and links to the commit. Draft changes last while Studio stays open.

Uploads are resized to a web image and a thumbnail. Keep your full-resolution masters separately. Hiding a piece removes it from the site’s catalogue while its files remain in the public repository. Git history keeps previous images and details. To undo a release, revert its commit in Git or roll back the Vercel deployment. When two sessions change the catalogue, the second one must reload and review the updated artwork before publishing.

The catalogue lives in `art/catalog.json` and its image paths are validated during the build. Each artwork has a stable ID, so artwork selections continue to resolve after a title edit. The archive can be rebuilt from Git without using the Studio interface. If the collection grows to thousands of pieces or needs private originals, move artwork files to object storage and keep the same catalogue IDs.
