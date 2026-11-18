# Spendora

Personal expense tracker. Flask + PostgreSQL API in `backend/`, React (Vite) UI in `frontend/`.

## Ports

| What | Port | Why |
|---|---|---|
| PostgreSQL (Docker) | 5434 | formsflow already uses 5431–5433 |
| Flask API | 5001 | formsflow web API uses 5000 |
| Vite dev server | 5173 | forwards `/api` to Flask |

Commands below are for Windows PowerShell, run from the project folder
(`expense-tracker`). Windows PowerShell 5.1 has no `&&`, so run each line on
its own. Calling `.\venv\Scripts\flask` directly means the venv never needs
activating.

## First-time setup

```powershell
docker compose up -d                        # Postgres; also creates expense_tracker_test
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements-dev.txt
copy .env.example .env                      # then set SECRET_KEY
.\venv\Scripts\flask db upgrade             # creates the expenses table
cd ..\frontend
npm install
```

## Run

Docker Desktop must be running (the database lives there). Then two terminals.

Backend:

```powershell
cd backend
.\venv\Scripts\flask run                    # http://127.0.0.1:5001
```

Frontend:

```powershell
cd frontend
npm run dev                                 # http://localhost:5173
```

Open the app at http://localhost:5173. http://127.0.0.1:5001/ only shows a
short JSON status - the API lives under `/api/...`.

If `flask run` says the port is in use, a Flask server is already running
(for example one started from the Claude app's preview). Stop that one, or
just use it.

## Login (Auth0)

Login is handled by [Auth0](https://auth0.com) (free tier). You sign in
with Google or email on Auth0's own page; Spendora never sees a password.
The browser then sends a short-lived **access token** with every API call,
and Flask accepts only tokens signed by your Auth0 tenant for this API
(`backend/app/auth.py`). Every expense and budget belongs to one user, and
each user only ever sees their own.

Until the steps below are done, the app shows "Login isn't set up yet" and
the API refuses `/api/expenses` and `/api/budgets` with a 503.

### 1. Create the Auth0 tenant and API

1. Sign up at auth0.com and create a tenant, e.g. `spendora-dev`. Your
   **domain** is shown at the top left, like `spendora-dev.eu.auth0.com`.
2. **Applications > APIs > Create API**
   - Name: `Spendora API`
   - Identifier: `https://api.spendora` (just a name, never called)
   - Signing algorithm: RS256
   - Then under **Settings > Access Settings**, turn on **Allow Offline
     Access** (lets the app stay logged in with refresh tokens).

### 2. Create the web app

**Applications > Applications > Create Application**, type **Single Page
Web Application**, name `Spendora web`. In its **Settings**:

| Field | Value |
|---|---|
| Allowed Callback URLs | `http://localhost:5173` |
| Allowed Logout URLs | `http://localhost:5173` |
| Allowed Web Origins | `http://localhost:5173` |
| Refresh Token Rotation | **On** |

Add your real address to all three URL fields when you host the app. Copy
the **Client ID**.

### 3. Turn on Google sign-in

**Authentication > Social > Google** (or **Create Connection > Google**),
then on its **Applications** tab enable it for `Spendora web`.

- Locally, Auth0's built-in test keys work as they are.
- For the live site, create your own (free) Google login credentials:
  Google Cloud Console > APIs & Services > Credentials > **Create
  credentials > OAuth client ID** (type *Web application*), with the
  authorized redirect URI `https://<your Auth0 domain>/login/callback`.
  Paste its Client ID and Client Secret into Auth0's Google settings.

Email + password login (**Authentication > Database >
Username-Password-Authentication**) is on by default. Turn it off for the
app if you only want Google.

### 4. Fill in the settings

`backend/.env`:

```
AUTH0_DOMAIN=spendora-dev.eu.auth0.com
AUTH0_AUDIENCE=https://api.spendora
```

`frontend/.env.local` (copy `frontend/.env.example`; git ignores it):

```
VITE_AUTH0_DOMAIN=spendora-dev.eu.auth0.com
VITE_AUTH0_CLIENT_ID=<the Client ID from step 2>
VITE_AUTH0_AUDIENCE=https://api.spendora
```

None of these are secrets. Restart both `flask run` and `npm run dev`;
`.env` files are only read at start-up.

### 5. Claim the data you had before login

Entries and budgets created before login existed belong to nobody
(`unassigned`). Log in once, open the account menu (your photo, top right),
copy **Your user ID**, then from `backend`:

```powershell
.\venv\Scripts\flask assign-owner "google-oauth2|1234567890"
```

Keep the quotes: PowerShell reads `|` as a pipe otherwise.

### Optional: only let yourself in

By default anyone can create an account. They only ever see their own
(empty) data, but to keep Spendora private add an Auth0 Action:
**Actions > Library > Create Action > Build from scratch**, trigger
*Login / Post Login*:

```js
exports.onExecutePostLogin = async (event, api) => {
  const allowed = ['you@example.com']
  if (!event.user.email_verified || !allowed.includes(event.user.email)) {
    api.access.deny('This Spendora is private.')
  }
}
```

**Deploy** it, then add it to **Actions > Triggers > post-login**. Anyone
else then sees "This Spendora is private." on the sign-in screen.

### Notes

- The browser keeps the login in `localStorage` (refresh token rotation),
  so it survives reloads. The alternative - Auth0's hidden iframe - breaks
  in browsers that block third-party cookies.
- Auth0's sign-in only works on `localhost` or `https://`. On a plain
  `http://192.168.x.x` address the app shows "Login needs a secure
  address" - use the phone server below.

### Testing on your phone

The phone server serves the app over HTTPS with a self-signed
certificate, so login works on a phone on the same Wi-Fi.

1. From `frontend`, run:

   ```powershell
   npm run dev:phone
   ```

   It prints a `Network:` line such as `https://192.168.1.5:5174/`.
2. In Auth0 (**Applications > Spendora web > Settings**), add that address,
   without the trailing slash, to **Allowed Callback URLs**, **Allowed
   Logout URLs** and **Allowed Web Origins** (comma-separated after
   `http://localhost:5173`). Save.
3. On the phone, open the address. It warns that the connection isn't
   private (the certificate is self-made): choose **Advanced >
   Proceed**. Then log in as usual.

If the phone can't reach the PC at all, the Windows firewall is blocking
Node: allow it on **Private** networks and set your home Wi-Fi to
Private. If your PC's address changes (it can when Wi-Fi reconnects),
repeat step 2 with the new one.

## Install on your phone (PWA)

Spendora is an installable web app (a PWA): from the browser you can add
it to the home screen, and it then opens full screen with its own icon,
like an app - no app store involved. The setup lives in
`frontend/vite.config.js` (manifest and service worker, via
`vite-plugin-pwa`).

**Installing needs a real `https://` address** - the hosted site. Phones
only offer to install from a site with a valid certificate; the
self-signed certificate of `npm run dev:phone` is enough to log in and
test, but not to install.

- **Android (Chrome):** open the site, then tap **Install app** in the
  menu (or the install banner when it appears).
- **iPhone (Safari):** open the site, tap **Share**, then **Add to Home
  Screen**.
- **Desktop Chrome / Edge:** the install icon at the right of the address
  bar.

Good to know:

- **Login:** the installed app keeps its own login - on iPhone it's
  separate from Safari, so you log in once inside the app.
- **Offline:** the app itself opens without a connection (its files are
  stored on the device), but expenses always come live from the server.
  Offline you see a "You're offline" banner and can't load or save
  entries until you reconnect.
- **Updates:** after a new version is deployed, the app shows "A new
  version of Spendora is ready" - tap **Reload** to switch, or **Later**
  to keep working. Nothing reloads by itself.
- **Icons** are made from `frontend/public/pwa-icon.svg`. After changing
  the logo, run `npm run generate-pwa-assets` in `frontend` and commit the
  PNGs it writes to `public/`.

**Trying it on your PC:** the service worker only runs in a production
build. From `frontend`:

```powershell
npm run build
npm run preview          # http://localhost:4173
```

To log in there, add `http://localhost:4173` to **Allowed Callback URLs**,
**Allowed Logout URLs** and **Allowed Web Origins** of *Spendora web* in
Auth0. Desktop Chrome then shows its install icon.

## API

All `/api/expenses` and `/api/budgets` calls need `Authorization: Bearer
<access token>`; without a valid one they return **401**. `/` and
`/api/health` stay public.

| Method | Path | Result |
|---|---|---|
| GET | `/api/health` | `{"status": "ok", "database": "ok"}` |
| GET | `/api/expenses` | all entries (expenses and income), newest date first |
| POST | `/api/expenses` | create → 201 |
| GET | `/api/expenses/<id>` | one entry |
| PUT | `/api/expenses/<id>` | replace all fields |
| DELETE | `/api/expenses/<id>` | delete → 204 |
| GET | `/api/budgets` | all budgets, by category |
| POST | `/api/budgets` | create → 201, or 409 if that category already has one |
| PUT | `/api/budgets/<id>` | replace category and limit |
| DELETE | `/api/budgets/<id>` | delete → 204 |

Entry body for POST/PUT:

```json
{
  "type": "expense",
  "title": "Weekly groceries",
  "amount": "84.35",
  "category": "Food",
  "expense_date": "2026-11-16",
  "description": "optional"
}
```

`type` is `"expense"` (the default) or `"income"`. Income needs no `category` - it is
stored as `"Income"`. The table and URL keep the name "expenses" for both.

Budget body: `{"category": "Food", "monthly_limit": "450.00"}`. A budget is a limit for
every calendar month; the app compares it with that month's expenses in the category.

Amounts come back as strings (`"84.35"`) so no precision is lost. Invalid input returns
422 with a message per field: `{"error": "Validation failed.", "fields": {"amount": "..."}}`.

The display currency (USD, EUR, INR, JPY, ...) is picked in the app's header and saved in
the browser. It changes how amounts are shown, not the stored numbers.

## Tests and checks

From `backend`:

```powershell
.\venv\Scripts\python -m pytest             # uses expense_tracker_test, never the dev DB
```

From `frontend`:

```powershell
npm run lint
npm run build
```

## Changing the database schema

Edit the model in `backend/app/models/`, then from `backend`:

```powershell
.\venv\Scripts\flask db migrate -m "describe the change"   # review the file it writes in migrations\versions\
.\venv\Scripts\flask db upgrade
```
