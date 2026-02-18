const baseCards = [
  ["1001", "A", "Alpha", "Omega", "Aleph", "Alfa"],
  ["1002", "B", "Beta", "Gamma", "Theta", "Zeta"],
  ["1003", "G", "Gamma", "Alpha", "Gammah", "Delta"],
  ["1004", "D", "Delta", "Beta", "Deltae", "Theta"],
  ["1005", "E", "Epsilon", "Alpha", "Epsylon", "Eta"],
  ["1006", "Th", "Theta", "Beta", "Theda", "Tau"],
  ["1007", "L", "Lambda", "Omega", "Lamda", "Gamma"],
  ["1008", "O", "Omega", "Alpha", "Omicron", "Omea"],
];

const flashcardData = baseCards.map(
  ([cardNumber, question, answer, distractor1, distractor2, distractor3]) => ({
    cardNumber: Number(cardNumber),
    question,
    answer,
    distractor1,
    distractor2,
    distractor3,
  }),
);

export default flashcardData;
