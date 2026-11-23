# To do

## Chat assistant: add entries by typing a sentence

Type "spent 250 on groceries yesterday" or "salary 5200 today" and get a
ready-to-save expense or income.

**Decided so far (2026-11-17)**

- **Model:** GPT-OSS 20B on Groq's free tier (`openai/gpt-oss-20b`). It's
  fast, needs no install, and supports structured (JSON schema) output.
- **Switchable provider:** Groq and Ollama both speak the OpenAI-style chat
  API, so the backend uses one client. Base URL, model and key live in
  `backend/.env`, which makes moving to a local Ollama model later a config
  change, not a code change.
- **Why not Ollama now:** this laptop has ~3.5 GB of RAM free with the
  formsflow containers running. GPT-OSS 20B needs ~14-16 GB, and a small
  3B model would be slower and less reliable.

**Plan**

- [ ] Get a free Groq API key (console.groq.com) and add `LLM_BASE_URL`,
      `LLM_MODEL`, `LLM_API_KEY` to `backend/.env` and `.env.example`.
- [ ] Backend: `POST /api/assistant/parse` takes `{ "message": "..." }` and
      returns draft entries. It never saves anything itself.
  - Send today's date and the category list with every request, so
    "yesterday" and "groceries -> Food" resolve correctly.
  - Ask for JSON matching the entry schema. One message can hold several
    entries ("lunch 12 and taxi 8").
  - Run every draft through the existing `validate_expense`. If the model
    returns something invalid, reply "Couldn't read that - try rephrasing"
    instead of guessing.
  - Keep reasoning effort low for speed; set a short timeout.
  - The API key stays on the server and never reaches the browser.
- [ ] Tests: mock the LLM call and cover a good parse, several entries,
      invalid model output, a timeout, and a missing API key.
- [ ] Frontend: a chat panel (floating button, design-kit style). Each
      draft shows as a card with **Save** / **Edit** / **Discard**; Edit
      opens it in the normal form.
- [ ] Handle the free-tier rate limit (HTTP 429) with a friendly message.

**Things to keep in mind**

- Chat text goes to Groq's servers. Don't type anything you wouldn't want
  to leave your PC.
- Free-tier limits (about 30 requests/minute and 1,000/day per third-party
  listings) and terms can change. Check console.groq.com for your account.

## Add an entry from a bank SMS (share or paste)

Phones never let a web app read SMS, so the user hands over one message at
a time: Share it to Spendora (Android) or paste it (iPhone, desktop). The
add dialog opens filled in for them to check and save.

**Plan**

- [ ] Android: add a `share_target` to the PWA manifest in
      `frontend/vite.config.js`, so the installed app shows up in the
      Share sheet.
  - Use `method: "POST"` and handle it in the service worker, so the SMS
    text never sits in a URL or reaches Netlify's logs. The SW is built by
    `generateSW`; add the handler with workbox `importScripts`, or switch
    to `injectManifest`.
  - The SW hands the text to the page, which opens the add dialog.
- [ ] iPhone and desktop: a "Paste SMS" box in the add dialog.
- [ ] Read the SMS with simple rules first (no LLM): amount (Rs / INR /
      ₹), debited vs credited, date, merchant or UPI name. Reuse
      `parseAmount` from `utils/csvImport.js`.
  - Ignore OTPs, offers and balance-only messages with a clear "This
    doesn't look like a payment" note.
  - Never save straight away; always show the filled form first.
- [ ] LLM fallback for formats the rules miss: send the text to
      `POST /api/assistant/parse` from the chat assistant above. A bank
      SMS is just another message, and the LLM also guesses the category.
  - Before sending, strip the available balance and reference numbers;
    the masked account number (XX1234) isn't needed either.
- [ ] Warn when the same amount on the same date already exists (reuse the
      CSV import's duplicate check).
- [ ] Tests: made-up sample SMS from several banks (debit, credit, UPI,
      card), plus OTP and promo messages that must be rejected. No real
      messages in the repo.

**Things to keep in mind**

- Share only works once the app is installed (Chrome on Android). iPhone
  web apps can't receive shared text, so iPhone users paste.
- It's one tap per message, not automatic. Automatic reading needs a
  native Android app plus Google Play's SMS permission review; iPhone
  doesn't allow it at all.
