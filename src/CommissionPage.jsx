import { useRef, useState } from "react";
import { commissionLink, requestTypes, sendInquiry, WHATSAPP_URL } from "./commissions";

function RequestForm({ type, artwork, onChoose, isContact }) {
  const [submission, setSubmission] = useState(null);
  const sending = useRef(false);
  const context = `${type}:${artwork?.title ?? ""}`;
  const status = submission?.status === "sending" || submission?.context === context ? submission.status : "idle";
  const isBuying = type === "artwork";
  const isGeneral = type === "general";

  async function submit(event) {
    event.preventDefault();
    if (sending.current || status === "sent") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const note = data.get("message").trim();
    if (!note && !(isBuying && artwork)) {
      form.elements.message.setCustomValidity("Please add a short note about your request.");
      form.elements.message.reportValidity();
      return;
    }
    if (data.get("website")) return;

    sending.current = true;
    setSubmission({ status: "sending", context });
    const email = data.get("email").trim();
    try {
      await sendInquiry({
        type,
        reference: artwork?.title,
        email,
        message: note || "Please confirm availability and delivery options.",
        website: "",
      });
      setSubmission({ status: "sent", context, email });
      form.reset();
    } catch {
      setSubmission({ status: "error", context });
    } finally {
      sending.current = false;
    }
  }

  if (status === "sent") {
    return (
      <section className="notebook-form">
        <div role="status">
          <h2 className="text-2xl font-semibold">Your request was sent</h2>
          <p className="mt-3 break-words text-sm leading-6 text-sky-100/78">I’ll reply to <strong>{submission.email}</strong> soon.</p>
        </div>
        <button type="button" className="notebook-send mt-5" onClick={() => setSubmission(null)}>Start another request</button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} aria-busy={status === "sending"} className="notebook-form">
      <fieldset disabled={status === "sending"} className="min-w-0">
        <div className={isContact ? "notebook-fields" : "notebook-fields notebook-fields-quote"}>
          {!isContact && (
            <label className="notebook-field">
              What are you looking for?
              <select name="type" value={type} onChange={(event) => onChoose(event.target.value, artwork?.id)}>
                {requestTypes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          )}
          <label className="notebook-field">
            Your email
            <input name="email" autoComplete="email" type="email" required maxLength={254} placeholder="you@example.com" />
          </label>
        </div>

        {artwork && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/12 bg-black/20 p-3">
            <img src={artwork.thumbnail} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-sky-100/65">{isBuying ? "Selected piece" : "Style reference"}</p>
              <p className="break-words text-sm font-semibold text-white">{artwork.title}</p>
            </div>
            <button type="button" onClick={() => onChoose(type)} className="min-h-11 shrink-0 text-xs underline underline-offset-4">Remove</button>
          </div>
        )}

        <label className="notebook-field notebook-message">
          {isBuying ? "Anything I should know?" : isGeneral ? "Your message" : "What would you like me to make?"}
          <textarea name="message" required={!(isBuying && artwork)} rows={4} maxLength={1200}
            onChange={(event) => event.target.setCustomValidity("")}
            placeholder={isBuying
              ? (artwork ? "Tell me where it would need to ship or what size you’re after." : "Include the title or describe the piece you’re looking for.")
              : isGeneral ? "What’s on your mind?" : "Tell me about the piece, when you need it, and any references."} />
        </label>

        <div hidden><input name="website" tabIndex={-1} autoComplete="off" aria-label="Leave blank" /></div>
        <div className="notebook-actions">
          <button type="submit" className="notebook-send" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : isBuying ? "Send purchase inquiry" : isGeneral ? "Send message" : "Send quote request"}
          </button>
        </div>
      </fieldset>
      {status === "error" && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-200/25 bg-amber-50/[.07] p-3 text-sm leading-6 text-amber-50">
          I couldn’t confirm delivery. Your details are still here. Try again or <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">message me on WhatsApp</a>.
        </div>
      )}
    </form>
  );
}

export default function CommissionPage({ type, artwork, isContact }) {
  const selected = isContact ? "general" : requestTypes.find((item) => item.id === type)?.id ?? requestTypes[0].id;
  const isBuying = selected === "artwork";
  const referenceArtwork = isContact || (isBuying && artwork?.availability === "unavailable") ? undefined : artwork;

  function choose(offer, reference) {
    const link = commissionLink(offer, reference);
    if (window.location.hash !== link) window.location.assign(link);
  }

  return (
    <section className="contact-page">
      <div className="contact-notebook">
        <header className="contact-heading">
          <div className="contact-orbit" aria-hidden="true">
            <span className="contact-planet" />
            <span className="contact-glint" />
          </div>
          {isContact ? (
            <h1>Send a note to<br /> the Chinese Satellite</h1>
          ) : (
            <>
              <h1>{isBuying ? "Ask to buy" : "Get a quote"}</h1>
              <p>{isBuying ? "Ask about an original or a print. I’ll confirm availability and delivery." : "Tell me what you’d like made. I’ll reply by email with a quote."}</p>
            </>
          )}
        </header>
        <RequestForm type={selected} artwork={referenceArtwork} onChoose={choose} isContact={isContact} />
      </div>
    </section>
  );
}
