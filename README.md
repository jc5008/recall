# Focus | Mastery Training Flashcards

A digital self-training system designed for rapid mastery of two-part concepts (Symbol/Meaning). This application uses a "Forced Recall" loop to ensure dependencies are built in both directions, presented in an Apple-inspired, clean interface.

## 🚀 Features

### 1. The Learning Loop
The system guides the user through three distinct phases to ensure mastery:
* **Exposure:** A low-stress, grid-based view of 8 items. The goal is simple familiarization.
* **Blind Recall:** Active testing. The answer is hidden. You must produce the answer before revealing it.
* **Missed-Only Loop:** The system tracks what you miss. You cannot proceed to the next batch until you have cleared your "Missed" stack.

### 2. Forced Two-Way Dependency
Unlike standard flashcards, this system automatically generates two cards for every data point:
1.  Symbol → Full Meaning
2.  Full Meaning → Symbol

This prevents "recognition-only" learning and builds true automaticity.

### 3. Intelligent Batching
You can dump hundreds of terms into the content file. The system automatically slices them into **Micro-Sets of 8**. This prevents cognitive overload and fits the ideal capacity of working memory.

### 4. Input Methods
* **Mouse/Touch:** Click to flip, click buttons to grade.
* **Keyboard:** * `SPACE` or `ENTER`: Flip Card
    * `LEFT ARROW`: Missed
    * `RIGHT ARROW`: I knew it
* **Gestures:**
    * Swipe Left: Missed
    * Swipe Right: I knew it

## 🛠 Setup & Usage

### 1. Installation
No server or installation is required.
1.  Download `index.html` and `content.js`.
2.  Place them in the same folder.
3.  Open `index.html` in any modern web browser (Chrome, Safari, Edge).

### 2. Editing Content
Open `content.js` in a text editor (Notepad, TextEdit, VS Code).
Add your terms to the `flashcardData` array in this format:

```javascript
const flashcardData = [
    { term: "Your Term", def: "Your Definition" },
    { term: "NaCl", def: "Sodium Chloride" },
    // Add as many as you want...
];
