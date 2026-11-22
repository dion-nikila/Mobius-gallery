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
