# Focus | Mastery Training (Next.js)

Focus is a Next.js flashcard trainer with multi-mode study:

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