# The Chinese Satellite Archive

Dion’s illustration portfolio and commission studio. The home page opens on the full-screen 3D Möbius gallery. Mobile devices and browsers without WebGL use the original interactive SVG strip. Buyers can request a commission or ask about an existing piece directly on the site.

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

Contact details and the request template live in `src/commissions.js`. The one-step inquiry form submits to FormSubmit, which delivers the request and reply address to the configured inbox. A new recipient must activate the service via its first email. Before promoting the build, submit a real test from the deployed URL and verify that it arrives. The Contact button opens direct links for Instagram, WhatsApp, and email, along with a general inquiry form. Confirm scope, price, deadline, delivery, usage rights, and cancellation terms before requesting a deposit. Verify receipt of the deposit and final balance in your own payment account.

For existing pieces, confirm availability, format, rights, shipping, and price individually before accepting a payment. For international commissions, confirm a working payment method in the quote. Card checkout can be added once an approved merchant account is in place.

## Manage artwork in Studio

Open [Studio](https://chinesesatellite.art/#/studio) and choose **Sign in with GitHub**. Use the repository owner’s `dion-nikila` account. Studio maintains a time-limited session in a secure, encrypted cookie. The **Use a GitHub token instead** section remains available while sign-in is being configured.

1. Choose **Add artwork**, attach a JPG, PNG, WebP, or AVIF, and enter a title. Optionally add year, medium, availability, a viewer note, and an image description.
2. Use **Hide** or **Show** next to a piece in the catalogue to control its visibility across the site. The **Hidden** filter lists pieces you can restore. Use **Move to top**, **Move earlier**, and **Move later** to set the gallery order. The landing gallery uses the first 16 visible pieces, and About gives priority to the first four visible pieces marked **Feature on About**.
3. Select **Review changes** to see which pieces will be added, updated, hidden, or restored. Then choose **Publish changes** to send the batch to GitHub. Studio shows the Vercel deployment status and links to the commit. Draft changes last while Studio stays open.

Uploads are resized to a web image and a thumbnail. Keep your full-resolution masters separately. Hiding a piece removes it from the site’s catalogue while its files remain in the public repository. Git history keeps previous images and details. To undo a release, revert its commit in Git or roll back the Vercel deployment. When two sessions change the catalogue, the second one must reload and review the updated artwork before publishing.

The catalogue lives in `art/catalog.json` and its image paths are validated during the build. Each artwork has a stable ID, so artwork selections continue to resolve after a title edit. The archive can be rebuilt from Git without using the Studio interface. If the collection grows to thousands of pieces or needs private originals, move artwork files to object storage and keep the same catalogue IDs.


### Activate GitHub sign-in

1. As `dion-nikila`, [register a GitHub App](https://github.com/settings/apps/new). Set its homepage to `https://chinesesatellite.art/#/studio`, callback to `https://chinesesatellite.art/api/studio-auth`, and disable webhooks. Enable expiring user authorization tokens.
2. Grant **Repository permissions → Contents → Read and write** and allow installation on **only this account**. Install the app using **Only select repositories → Mobius-gallery**.
3. In the `mobius-gallery` Vercel project, add these Production environment variables and redeploy. Enter secrets directly into Vercel and mark the last two as sensitive.

| Name | Value |
| --- | --- |
| `STUDIO_GITHUB_CLIENT_ID` | The GitHub App’s client ID |
| `STUDIO_GITHUB_CLIENT_SECRET` | The GitHub App’s client secret |
| `STUDIO_SESSION_KEY` | 32 random bytes encoded as 64 hex characters, generated locally with `openssl rand -hex 32` |

Studio account access is limited to `dion-nikila` and the publishing endpoints accept catalogue changes and artwork images only. Sessions expire after seven hours. The public gallery uses the last successful static Vercel deployment and does not request data from Studio or GitHub at runtime.
