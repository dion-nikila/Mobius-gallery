import { useRef, useState } from "react";
import { commissionLink, INSTAGRAM_URL, offers, requestTypes, sendInquiry, WHATSAPP_URL } from "./commissions";

const field = "w-full min-w-0 rounded-lg border border-sky-100/20 bg-[#070f1a] px-3 py-3 text-base text-white focus:border-sky-100/60";
const label = "grid gap-2 text-sm font-medium text-sky-100/85";
const button = "inline-flex min-h-12 items-center justify-center rounded-full bg-sky-50 px-6 text-sm font-semibold text-[#07111b] hover:bg-white disabled:cursor-wait disabled:opacity-60";

const steps = [
  ["Send your request", "Tell me what you’re looking for and leave an email for my reply."],
  ["Get a quote", "I’ll confirm the price, timing, and what’s included. For existing work, I’ll check the format and delivery cost."],
  ["Book your commission", "A 50% deposit reserves the slot once you accept the quote. Standard personal commissions include one sketch revision."],
  ["Receive the art", "I’ll send the finished digital files once the balance clears. We’ll agree on delivery separately for physical work."],
];

function RequestForm({ type, artwork, onChoose, formRef }) {
  const [submission, setSubmission] = useState(null);
  const sending = useRef(false);
  const context = `${type}:${artwork?.title ?? ""}`;
  const status = submission?.status === "sending" || submission?.context === context ? submission.status : "idle";
  const isBuying = type === "artwork";
  const isGeneral = type === "general";
  const chosen = offers.find((offer) => offer.id === type);

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
        message: note || "Please confirm availability, price, and delivery options.",
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
      <section ref={formRef} tabIndex={-1} className="scroll-mt-24 archive-panel p-5 md:p-7">
        <div role="status">
          <h2 className="text-2xl font-semibold">Your request was sent</h2>
          <p className="mt-3 break-words text-sm leading-6 text-sky-100/78">I’ll reply to <strong>{submission.email}</strong> soon.</p>
        </div>
        <button type="button" className={`${button} mt-5`} onClick={() => setSubmission(null)}>Start another request</button>
      </section>
    );
  }

  return (
    <form ref={formRef} tabIndex={-1} onSubmit={submit} aria-busy={status === "sending"} className="min-w-0 self-start archive-panel p-5 md:p-7">
      <h2 className="text-2xl font-semibold tracking-tight">{isBuying ? "Ask to buy" : isGeneral ? "Send a message" : "Request a quote"}</h2>
      <fieldset disabled={status === "sending"} className="min-w-0">
        {!isGeneral && <label className={`mt-4 ${label}`}>
          Request type
          <select name="type" value={type} onChange={(event) => onChoose(event.target.value, artwork?.title)} className={field}>
            {requestTypes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>}
        {chosen && <p className="mt-1.5 text-sm font-semibold text-sky-200">{chosen.price}</p>}

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

        <label className={`mt-4 ${label}`}>
          Your email
          <input name="email" autoComplete="email" type="email" required maxLength={254} className={field} placeholder="you@example.com" />
        </label>

        <label className={`mt-4 ${label}`}>
          {isBuying ? "Anything I should know?" : isGeneral ? "Your message" : "What would you like me to make?"}
          <textarea name="message" required={!(isBuying && artwork)} rows={3} maxLength={1200} className={`${field} resize-y`}
            onChange={(event) => event.target.setCustomValidity("")}
            placeholder={isBuying
              ? (artwork ? "For example, the size you want or where it would need to ship." : "Include the title or describe the piece you’re looking for.")
              : "A few sentences are enough. Include a link to any references if you have one."} />
        </label>

        <div hidden><input name="website" tabIndex={-1} autoComplete="off" aria-label="Leave blank" /></div>
        <button type="submit" className={`${button} mt-5 w-full sm:w-auto`} disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : isBuying ? "Send purchase inquiry" : isGeneral ? "Send message" : "Send quote request"}
        </button>
      </fieldset>
      {status === "error" && (
        <div role="alert" className="mt-4 rounded-lg border border-amber-200/25 bg-amber-50/[.07] p-3 text-sm leading-6 text-amber-50">
          I couldn’t confirm delivery. Your details are still here. Try again or <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">message me on WhatsApp</a>.
        </div>
      )}
    </form>
  );
}

export default function CommissionPage({ type, artwork, formRef, isContact, visual }) {
  const selected = requestTypes.some((item) => item.id === type) ? type : offers[0].id;
  const isBuying = selected === "artwork";

  function choose(offer, reference, focusForm = false) {
    const link = commissionLink(offer, reference);
    if (window.location.hash !== link) window.location.assign(link);
    if (focusForm) formRef.current?.focus();
  }

  return (
    <section className="archive-page px-5 pb-20 pt-28 md:pt-32">
      <div className="mx-auto max-w-7xl">
      <header className="archive-heading pb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/70">The Chinese Satellite Archive</p>
        <h1 className="archive-title mt-3">{isContact ? "Get in touch" : isBuying ? "Buy existing art" : "Commission a piece"}</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-sky-100/73">{isContact ? "For collaborations, commissions, or questions about the artwork, reach me directly or send a message below." : isBuying ? "Ask about an original or a print before paying." : "Choose what you’d like made and tell me a little about it. You’ll get a personal reply before deciding whether to book."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={INSTAGRAM_URL} className={button}>@thechinese.satellite</a>
          <a href={WHATSAPP_URL} className={button}>WhatsApp</a>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <RequestForm type={selected} artwork={artwork} onChoose={choose} formRef={formRef} />

        {isContact && visual}
        {!isContact && <aside className="min-w-0">
          <h2 className="text-lg font-semibold">Commission options</h2>
          <div className="mt-3 grid gap-2.5">
            {offers.map((offer) => (
              <button key={offer.id} type="button" aria-pressed={selected === offer.id} onClick={() => choose(offer.id, artwork?.title, true)}
                className="archive-panel p-4 text-left hover:border-sky-100/45 aria-pressed:border-sky-300/55 aria-pressed:bg-sky-300/[.08]">
                <span className="block font-semibold">{offer.title}</span>
                <span className="mt-1 block text-sm font-semibold text-sky-200">{offer.price}</span>
                <span className="mt-1.5 block text-sm leading-6 text-sky-100/72">{offer.description}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 text-sm">
            <a href="#/work" className="inline-flex min-h-11 items-center text-sky-100 underline underline-offset-4">Browse existing art</a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sky-100 underline underline-offset-4">Ask on WhatsApp</a>
          </div>
        </aside>}
      </div>

      {!isContact && <section className="mt-10 border-t border-white/12 pt-7">
        <h2 className="text-2xl font-semibold">What happens next</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([title, description]) => (
            <li key={title} className="archive-panel p-4">
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-sky-100/72">{description}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-sky-100/70">I’ll confirm the payment method, usage rights, and any cancellation terms in your quote.</p>
      </section>}
      </div>
    </section>
  );
}
