export const CONTACT_EMAIL = "dionnikila330@gmail.com";
export const INSTAGRAM_URL = "https://www.instagram.com/thechinese.satellite/";
export const WHATSAPP_NUMBER = "94767702100";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export const requestTypes = [
  { id: "portrait", title: "Portrait or character" },
  { id: "illustration", title: "Custom illustration" },
  { id: "commercial", title: "Cover, poster or commercial art" },
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
