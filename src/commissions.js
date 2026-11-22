export const CONTACT_EMAIL = "dionnikila330@gmail.com";
export const INSTAGRAM_URL = "https://www.instagram.com/thechinese.satellite/";
const WHATSAPP_NUMBER = "94767702100";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export const offers = [
  {
    id: "portrait",
    title: "Portrait or character",
    description: "One person or original character, a simple background, and a high-resolution digital image for personal use.",
  },
  {
    id: "illustration",
    title: "Custom illustration",
    description: "A more detailed personal piece with room for a second subject, a setting, or a more elaborate composition.",
  },
  {
    id: "commercial",
    title: "Cover, poster or commercial art",
    description: "Original artwork for a release, event, publication, or campaign. The quote covers the formats and usage we agree on.",
  },
];

export const requestTypes = [
  ...offers,
  { id: "artwork", title: "Buy existing art" },
  { id: "general", title: "General inquiry" },
];

export function commissionLink(offer, reference) {
  const query = new URLSearchParams();
  if (offer) query.set("type", offer);
  if (reference) query.set("reference", reference);
  return `#/commissions${query.size ? `?${query}` : ""}`;
}

export async function sendInquiry({ type, reference, email, message, website }) {
  const request = requestTypes.find((item) => item.id === type).title;
  const response = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email,
      _subject: `The Chinese Satellite Archive inquiry · ${request}`,
      _template: "table",
      _honey: website,
      "Request type": request,
      ...(reference && { Artwork: reference }),
      Message: message,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();

  if (!response.ok || (result.success !== true && result.success !== "true")) {
    throw new Error("Email delivery was not accepted.");
  }
}
