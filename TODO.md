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
