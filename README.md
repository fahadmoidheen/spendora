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

## API

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
