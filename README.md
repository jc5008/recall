# Recall | Mastery Training (Next.js)

Recall is a Next.js flashcard trainer with multi-mode study:

1. Reference
2. Exposure
3. Grid
4. Recall
5. Loop
6. Quiz

It now supports multiple decks from a folder of deck files.

## Run Locally

1. `npm install`
2. `npm run dev`
3. Open `http://localhost:3000`

## Build

- `npm run build`
- `npm start`

## Database Migrations (Neon)

- Ensure `DATABASE_URL` is set in `.env.local`.
- Run: `npm run db:migrate`

## Admin Reports

- Set both in `.env.local`:
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_SECRET`
- Open `/admin/reports` and sign in with `ADMIN_PASSWORD`.
- Backing APIs:
  - `GET /api/admin/reports/top-difficult-cards`
  - `GET /api/admin/reports/employee-progress`

### Bootstrap an admin user account

1. Register a user at `/auth`.
2. Promote that user by email:
   - `npm run admin:promote -- user@example.com`
3. Sign in at `/auth` as that user.
4. Open `/admin/reports` (admin role can access without separate admin password flow).

## User Authentication

- Set in `.env.local`:
  - `AUTH_SESSION_SECRET`
- Optional for password-only anonymous access:
  - `ANONYMOUS_PASSWORD`
- Use `/auth` to register/sign in users.
- Use the `Anonymous` tab on `/auth` to sign in without username/email (password only).
- Signed-in user identity is attached to telemetry server-side.

## Tests

- Run all tests: `npm test`

## How Reports Are Pulled (Modes and Metrics)

1. **Generate telemetry first**
   - Use the training app in each mode (`reference`, `exposure`, `grid`, `recall`, `loop`, `quiz`).
   - Events are stored in mode-specific tables:
     - `search_logs`, `reference_views`, `session_logs`
     - `card_interactions`, `phase_logs`
     - `quiz_attempts`, `quiz_timing`, `quiz_results`, `card_timing`
     - `loop_metrics`, `session_abandons`, `mastery_logs`

2. **Top difficult cards (competence/problem areas)**
   - Endpoint: `GET /api/admin/reports/top-difficult-cards`
   - Optional params: `deck`, `limit`, `minAttempts`
   - Uses `quiz_attempts` to rank low-accuracy cards.

3. **Employee progress (mastery)**
   - Endpoint: `GET /api/admin/reports/employee-progress`
   - Optional params: `deck`, `limit`
   - Uses `mastery_logs` to summarize mastered cards by user/deck.

4. **Mode-specific diagnostics (SQL examples)**
   - **Reference struggling terms**:
     - query top `search_term` from `search_logs`.
   - **Grid engagement**:
     - count `card_interactions` where `phase='grid'` and `interaction_type='flip'`.
   - **Exposure dwell quality**:
     - aggregate `phase_logs` where `phase='exposure'`.
   - **Recall confidence**:
     - analyze `quiz_results` + `card_timing` for accuracy and latency.
   - **Loop remediation effort**:
     - analyze `loop_metrics` and `session_abandons` where `phase='loop'`.

## Decks Folder

Decks live in `decks/` as JavaScript files that default-export an array.

- File name (without `.js`) is the deck name in the dropdown.
- Example: `decks/greek_letters.js` appears as `Greek Letters`.
- Register each new deck in `decks/index.js` using the same key as the filename.

### Deck File Format

Each card now includes:

- `cardNumber`
- `question`
- `answer`
- `distractor1`
- `distractor2`
- `distractor3`

```js
const flashcardData = [
  {
    cardNumber: 1,
    question: "H",
    answer: "Hydrogen",
    distractor1: "Helium",
    distractor2: "Lithium",
    distractor3: "Beryllium",
  },
];

export default flashcardData;
```

## Home Screen Flow

- App opens to Home with a deck dropdown.
- User selects a deck and clicks Start Deck.
- Clicking Home during study returns to deck selection and resets progress.
- Search filters cards by any field (`cardNumber`, `question`, `answer`, distractors).
- Shuffle randomizes card order across all modes.

## Project Structure

```text
.
├── app/
│   ├── FlashcardAppClient.jsx
│   ├── globals.css
│   ├── layout.jsx
│   └── page.jsx
├── decks/
│   ├── elements.js
│   ├── greek_letters.js
│   └── index.js
├── next.config.mjs
└── package.json
```