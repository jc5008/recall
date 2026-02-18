"use client";

import { useEffect, useMemo, useState } from "react";

const BATCH_SIZE = 8;
const MODES = ["reference", "exposure", "grid", "recall", "loop", "quiz"];

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function formatDeckName(deckName) {
  return deckName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickCardField(card, keys) {
  for (const key of keys) {
    if (card[key] !== undefined && card[key] !== null) {
      return card[key];
    }
  }
  return undefined;
}

function normalizeDeck(deckCards) {
  const safeCards = Array.isArray(deckCards) ? deckCards : [];

  return safeCards.map((card, index) => {
    if (Array.isArray(card)) {
      const [cardNumber, question, answer, distractor1, distractor2, distractor3] = card;
      return {
        cardNumber: Number(cardNumber) || index + 1,
        question: String(question ?? ""),
        answer: String(answer ?? ""),
        distractor1: String(distractor1 ?? ""),
        distractor2: String(distractor2 ?? ""),
        distractor3: String(distractor3 ?? ""),
      };
    }

    const cardNumber = pickCardField(card, ["cardNumber", "Card Number", "card_number"]);
    const question = pickCardField(card, ["question", "Question"]);
    const answer = pickCardField(card, ["answer", "Answer"]);
    const distractor1 = pickCardField(card, ["distractor1", "Distractor 1", "distractor_1"]);
    const distractor2 = pickCardField(card, ["distractor2", "Distractor 2", "distractor_2"]);
    const distractor3 = pickCardField(card, ["distractor3", "Distractor 3", "distractor_3"]);

    return {
      cardNumber: Number(cardNumber) || index + 1,
      question: String(question ?? ""),
      answer: String(answer ?? ""),
      distractor1: String(distractor1 ?? ""),
      distractor2: String(distractor2 ?? ""),
      distractor3: String(distractor3 ?? ""),
    };
  });
}

function includesQuery(value, query) {
  return String(value).toLowerCase().includes(query);
}

function buildStudyQueue(cards) {
  const queue = [];
  cards.forEach((card) => {
    queue.push({
      cardNumber: card.cardNumber,
      front: card.question,
      back: card.answer,
    });
    queue.push({
      cardNumber: card.cardNumber,
      front: card.answer,
      back: card.question,
    });
  });
  return shuffle(queue);
}

function buildQuizOptions(card) {
  const options = [card.answer, card.distractor1, card.distractor2, card.distractor3].filter(
    Boolean,
  );
  return shuffle(options);
}

export default function FlashcardAppClient({ decks }) {
  const deckNames = useMemo(() => Object.keys(decks).sort(), [decks]);
  const [selectedDeckName, setSelectedDeckName] = useState(deckNames[0] ?? "");
  const [activeDeckName, setActiveDeckName] = useState("");
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [mode, setMode] = useState("exposure");
  const [searchQuery, setSearchQuery] = useState("");
  const [orderedCards, setOrderedCards] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

  const [studyQueue, setStudyQueue] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);
  const [studySwipeClass, setStudySwipeClass] = useState("");
  const [missedItems, setMissedItems] = useState([]);
  const [loopMisses, setLoopMisses] = useState([]);

  const [gridFlips, setGridFlips] = useState({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizOptions, setQuizOptions] = useState([]);
  const [quizSelected, setQuizSelected] = useState("");
  const [quizChecked, setQuizChecked] = useState(false);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);

  const isHomeScreen = !activeDeckName;
  const activeDeckData = useMemo(
    () => (activeDeckName ? normalizeDeck(decks[activeDeckName]) : []),
    [activeDeckName, decks],
  );

  const query = searchQuery.trim().toLowerCase();
  const filteredCards = useMemo(() => {
    if (!query) return activeDeckData;
    return activeDeckData.filter((card) => {
      return (
        includesQuery(card.cardNumber, query) ||
        includesQuery(card.question, query) ||
        includesQuery(card.answer, query) ||
        includesQuery(card.distractor1, query) ||
        includesQuery(card.distractor2, query) ||
        includesQuery(card.distractor3, query)
      );
    });
  }, [activeDeckData, query]);

  const allBatches = useMemo(() => {
    const batches = [];
    for (let i = 0; i < orderedCards.length; i += BATCH_SIZE) {
      batches.push(orderedCards.slice(i, i + BATCH_SIZE));
    }
    return batches;
  }, [orderedCards]);

  const currentBatchData = allBatches[currentBatchIndex] ?? [];
  const currentStudyCard = studyQueue[studyIndex];
  const hasStudyCard = Boolean(currentStudyCard);
  const quizCard = orderedCards[quizIndex];

  const progress = useMemo(() => {
    if (mode === "recall" || mode === "loop") {
      if (!studyQueue.length) return 0;
      return studyIndex >= studyQueue.length
        ? 100
        : (studyIndex / Math.max(studyQueue.length, 1)) * 100;
    }
    if (mode === "quiz") {
      if (!orderedCards.length) return 0;
      return ((quizIndex + 1) / orderedCards.length) * 100;
    }
    return 0;
  }, [mode, studyQueue.length, studyIndex, quizIndex, orderedCards.length]);

  function resetInteractiveState() {
    setStudyQueue([]);
    setStudyIndex(0);
    setStudyFlipped(false);
    setStudySwipeClass("");
    setMissedItems([]);
    setLoopMisses([]);
    setGridFlips({});
    setQuizIndex(0);
    setQuizOptions([]);
    setQuizSelected("");
    setQuizChecked(false);
  }

  function resetSessionToDeckStart() {
    setCurrentBatchIndex(0);
    setMode("exposure");
    resetInteractiveState();
  }

  function applySearchAndDeckOrder(nextCards) {
    setOrderedCards(nextCards);
    setCurrentBatchIndex(0);
    resetInteractiveState();
  }

  function startRecall() {
    setMode("recall");
    setStudyQueue(buildStudyQueue(currentBatchData));
    setStudyIndex(0);
    setStudyFlipped(false);
    setStudySwipeClass("");
    setMissedItems([]);
    setLoopMisses([]);
  }

  function startLoop() {
    const loopCards = currentBatchData.filter((card) =>
      new Set(missedItems).has(card.cardNumber),
    );
    setMode("loop");
    setStudyQueue(buildStudyQueue(loopCards));
    setStudyIndex(0);
    setStudyFlipped(false);
    setStudySwipeClass("");
    setLoopMisses([]);
  }

  function startDeck() {
    if (!selectedDeckName) return;
    setActiveDeckName(selectedDeckName);
    if (isSmallScreen) {
      setIsHeaderCollapsed(true);
    }
    setIsHelpOpen(false);
    setMode("exposure");
    setSearchQuery("");
    setCurrentBatchIndex(0);
    resetInteractiveState();
  }

  function goHome() {
    setActiveDeckName("");
    setIsHelpOpen(false);
    setSearchQuery("");
    resetSessionToDeckStart();
  }

  function loadBatch(index) {
    setCurrentBatchIndex(index);
    if (mode === "recall" || mode === "loop") {
      setMode("exposure");
    }
    resetInteractiveState();
  }

  function shuffleCards() {
    applySearchAndDeckOrder(shuffle(filteredCards));
  }

  function setModeSafe(nextMode) {
    if (!MODES.includes(nextMode)) return;
    setMode(nextMode);
    if (nextMode !== "loop") {
      setLoopMisses([]);
    }
    if (nextMode === "quiz") {
      setQuizIndex(0);
      setQuizSelected("");
      setQuizChecked(false);
    }
    if (nextMode !== "recall" && nextMode !== "loop") {
      setStudyFlipped(false);
      setStudySwipeClass("");
    }
  }

  function flipStudyCard() {
    if (!hasStudyCard || studyFlipped || mode === "exposure") return;
    setStudyFlipped(true);
  }

  function handleStudyResult(success) {
    if (!studyFlipped || !hasStudyCard) return;
    const animationClass = success ? "swipe-right" : "swipe-left";
    setStudySwipeClass(animationClass);

    if (!success) {
      if (mode === "recall") {
        setMissedItems((prev) => [...prev, currentStudyCard.cardNumber]);
      } else if (mode === "loop") {
        setLoopMisses((prev) => [...prev, currentStudyCard.cardNumber]);
      }
    }

    window.setTimeout(() => {
      setStudyIndex((prev) => prev + 1);
      setStudyFlipped(false);
      setStudySwipeClass("");
    }, 300);
  }

  function toggleGridCard(cardNumber) {
    setGridFlips((prev) => ({ ...prev, [cardNumber]: !prev[cardNumber] }));
  }

  function updateQuizOptions(nextIndex) {
    const card = orderedCards[nextIndex];
    if (!card) {
      setQuizOptions([]);
      return;
    }
    setQuizOptions(buildQuizOptions(card));
  }

  function goToQuizIndex(nextIndex) {
    if (!orderedCards.length) return;
    const bounded = Math.max(0, Math.min(nextIndex, orderedCards.length - 1));
    setQuizIndex(bounded);
    setQuizSelected("");
    setQuizChecked(false);
    updateQuizOptions(bounded);
  }

  function checkQuizAnswer() {
    if (!quizSelected || !quizCard) return;
    setQuizChecked(true);
  }

  function retryLoop() {
    const retryNumbers = [...new Set(loopMisses)];
    const retryCards = currentBatchData.filter((card) => retryNumbers.includes(card.cardNumber));
    setMissedItems(retryNumbers);
    setLoopMisses([]);
    setMode("loop");
    setStudyQueue(buildStudyQueue(retryCards));
    setStudyIndex(0);
    setStudyFlipped(false);
    setStudySwipeClass("");
  }

  useEffect(() => {
    applySearchAndDeckOrder(filteredCards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCards]);

  useEffect(() => {
    if (!orderedCards.length) return;
    if (quizIndex >= orderedCards.length) {
      goToQuizIndex(0);
      return;
    }
    updateQuizOptions(quizIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCards.length]);

  useEffect(() => {
    if (isHomeScreen) return;
    const onKeyDown = (e) => {
      if (e.code === "Space") e.preventDefault();

      if (mode === "recall" || mode === "loop") {
        if (e.code === "Space" || e.code === "Enter") {
          flipStudyCard();
        } else if (e.code === "ArrowLeft") {
          handleStudyResult(false);
        } else if (e.code === "ArrowRight") {
          handleStudyResult(true);
        }
      } else if (mode === "quiz") {
        if (e.code === "ArrowLeft") {
          goToQuizIndex(quizIndex - 1);
        } else if (e.code === "ArrowRight") {
          goToQuizIndex(quizIndex + 1);
        } else if (e.code === "Enter") {
          if (!quizChecked) checkQuizAnswer();
          else goToQuizIndex(quizIndex + 1);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isHomeScreen, mode, studyFlipped, quizIndex, quizChecked, quizSelected]);

  useEffect(() => {
    if (!selectedDeckName && deckNames.length > 0) {
      setSelectedDeckName(deckNames[0]);
    }
  }, [selectedDeckName, deckNames]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 480px)");
    const applyScreenState = (isMobile) => {
      setIsSmallScreen(isMobile);
      if (!isMobile) {
        setIsHeaderCollapsed(false);
      } else {
        setIsHeaderCollapsed(true);
      }
    };

    applyScreenState(mediaQuery.matches);
    const onChange = (event) => applyScreenState(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  if (!deckNames.length) {
    return (
      <main>
        <h1 className="instruction-text">No deck files found in the decks folder.</h1>
      </main>
    );
  }

  if (!isHomeScreen && !activeDeckData.length) {
    return (
      <main>
        <h1 className="instruction-text">Selected deck is empty.</h1>
        <div className="controls active">
          <button className="btn btn-next" onClick={goHome}>
            Return Home
          </button>
        </div>
      </main>
    );
  }

  const batchCount = allBatches.length;
  const batchNumber = Math.min(currentBatchIndex + 1, Math.max(batchCount, 1));
  const recallOrLoopDone = studyIndex >= studyQueue.length;
  const uniqueMissed = [...new Set(missedItems)];
  const uniqueLoopMisses = [...new Set(loopMisses)];
  const hasLoopSource = uniqueMissed.length > 0 || studyQueue.length > 0 || uniqueLoopMisses.length > 0;
  const showHeaderDetails = !isHomeScreen && (!isSmallScreen || !isHeaderCollapsed);

  return (
    <>
      <header>
        {isHomeScreen ? (
          <div className="batch-indicator">Choose a deck to begin</div>
        ) : (
          <div className="header-row">
            <div className="batch-indicator">
              {`${formatDeckName(activeDeckName)} | Batch ${batchNumber} of ${Math.max(batchCount, 1)}`}
            </div>
            <div className="header-action-group">
              {isSmallScreen && (
                <button
                  className="header-toggle-btn"
                  onClick={() => setIsHeaderCollapsed((prev) => !prev)}
                  aria-label={isHeaderCollapsed ? "Expand header" : "Collapse header"}
                >
                  {isHeaderCollapsed ? "Expand" : "Collapse"}
                </button>
              )}
              <button className="home-btn" onClick={goHome}>
                Home
              </button>
            </div>
          </div>
        )}
        {showHeaderDetails && (
          <>
            <div className="nav-pills mode-pills">
              <button
                className={`nav-item ${mode === "reference" ? "active" : ""}`}
                onClick={() => setModeSafe("reference")}
              >
                Reference
              </button>
              <button
                className={`nav-item ${mode === "exposure" ? "active" : ""}`}
                onClick={() => setModeSafe("exposure")}
              >
                Exposure
              </button>
              <button
                className={`nav-item ${mode === "grid" ? "active" : ""}`}
                onClick={() => setModeSafe("grid")}
              >
                Grid
              </button>
              <button
                className={`nav-item ${mode === "recall" ? "active" : ""}`}
                onClick={() => {
                  if (!studyQueue.length || mode !== "recall") startRecall();
                  else setModeSafe("recall");
                }}
              >
                Recall
              </button>
              <button
                className={`nav-item ${mode === "loop" ? "active" : ""}`}
                onClick={() => {
                  if (missedItems.length > 0) startLoop();
                  else setModeSafe("loop");
                }}
              >
                Loop
              </button>
              <button
                className={`nav-item ${mode === "quiz" ? "active" : ""}`}
                onClick={() => {
                  setModeSafe("quiz");
                  goToQuizIndex(0);
                }}
              >
                Quiz
              </button>
            </div>

            <div className="toolbar-row">
              <input
                className="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any card field..."
              />
              <button className="btn btn-quiet" onClick={shuffleCards}>
                Shuffle
              </button>
            </div>
          </>
        )}
      </header>

      <main>
        {isHomeScreen ? (
          <div className="home-card">
            <h1 className="instruction-text">Focus | Mastery Training</h1>
            <p className="home-subtext">
              Select a deck, then start your exposure, recall, and loop session.
            </p>
            <label className="home-label" htmlFor="deckSelect">
              Deck
            </label>
            <select
              id="deckSelect"
              className="deck-select"
              value={selectedDeckName}
              onChange={(e) => setSelectedDeckName(e.target.value)}
            >
              {deckNames.map((deckName) => (
                <option key={deckName} value={deckName}>
                  {formatDeckName(deckName)}
                </option>
              ))}
            </select>
            <button className="btn btn-next home-start-btn" onClick={startDeck}>
              Start Deck
            </button>
          </div>
        ) : (
          <>
            {mode === "reference" && (
              <div className="reference-list">
                {orderedCards.map((card) => (
                  <div className="reference-row" key={card.cardNumber}>
                    <div className="ref-number">{card.cardNumber}</div>
                    <div className="ref-question">{card.question}</div>
                    <div className="ref-answer">{card.answer}</div>
                  </div>
                ))}
                {!orderedCards.length && (
                  <h1 className="instruction-text">No cards match this search.</h1>
                )}
              </div>
            )}

            {mode === "exposure" && (
              <>
                <h1 className="instruction-text">
                  Rapid Exposure
                  <span className="sub-text">
                    {`Scan these ${currentBatchData.length} pairs. Just familiarize.`}
                  </span>
                </h1>

                <div className="exposure-grid visible">
                  {currentBatchData.map((item, index) => (
                    <div
                      key={`${item.cardNumber}-${item.question}`}
                      className="exposure-card"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <span className="exp-term">{item.question}</span>
                      <span className="exp-def">{item.answer}</span>
                    </div>
                  ))}
                </div>

                <div className="controls active">
                  <button
                    className="btn btn-quiet"
                    onClick={() => loadBatch(Math.max(currentBatchIndex - 1, 0))}
                    disabled={currentBatchIndex === 0}
                  >
                    Previous Batch
                  </button>
                  <button className="btn btn-next" onClick={startRecall}>
                    Start Recall
                  </button>
                  <button
                    className="btn btn-quiet"
                    onClick={() =>
                      loadBatch(Math.min(currentBatchIndex + 1, Math.max(batchCount - 1, 0)))
                    }
                    disabled={currentBatchIndex >= batchCount - 1}
                  >
                    Next Batch
                  </button>
                </div>
              </>
            )}

            {mode === "grid" && (
              <div className="study-grid">
                {orderedCards.map((card) => {
                  const flipped = Boolean(gridFlips[card.cardNumber]);
                  return (
                    <button
                      key={card.cardNumber}
                      className="grid-flip-card"
                      onClick={() => toggleGridCard(card.cardNumber)}
                    >
                      <div className={`grid-card-inner ${flipped ? "flipped" : ""}`}>
                        <div className="grid-card-face grid-card-front">
                          <div className="grid-card-label">Question</div>
                          <div className="grid-card-content">{card.question}</div>
                          <div className="grid-card-number">{card.cardNumber}</div>
                        </div>
                        <div className="grid-card-face grid-card-back">
                          <div className="grid-card-label">Answer</div>
                          <div className="grid-card-content">{card.answer}</div>
                          <div className="grid-card-number">{card.cardNumber}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {!orderedCards.length && (
                  <h1 className="instruction-text">No cards match this search.</h1>
                )}
              </div>
            )}

            {(mode === "recall" || mode === "loop") && (
              <>
                {hasStudyCard && !recallOrLoopDone ? (
                  <>
                    <h1 className="instruction-text">
                      {mode === "recall" ? "Blind Recall" : "Missed Loop"}
                      <span className="sub-text">
                        {mode === "recall"
                          ? "Testing Symbol to Meaning and Meaning to Symbol."
                          : "Drilling the ones you missed."}
                      </span>
                    </h1>

                    <div
                      className="card-container visible"
                      onClick={flipStudyCard}
                      onTouchStart={(e) =>
                        setTouchStartX(e.changedTouches?.[0]?.screenX ?? 0)
                      }
                      onTouchEnd={(e) => {
                        if (!studyFlipped) return;
                        const endX = e.changedTouches?.[0]?.screenX ?? touchStartX;
                        const threshold = 50;
                        if (touchStartX - endX > threshold) handleStudyResult(false);
                        if (endX - touchStartX > threshold) handleStudyResult(true);
                      }}
                    >
                      <div
                        className={`flashcard ${studyFlipped ? "flipped" : ""} ${studySwipeClass}`}
                      >
                        <div className="card-face front">
                          <div className="card-label">Prompt</div>
                          <div className="card-content">{currentStudyCard.front}</div>
                        </div>
                        <div className="card-face back">
                          <div className="card-label">Answer</div>
                          <div className="card-content">{currentStudyCard.back}</div>
                        </div>
                      </div>
                    </div>

                    <div className={`controls ${studyFlipped ? "active" : ""}`}>
                      <button
                        className="btn btn-miss"
                        onClick={() => handleStudyResult(false)}
                      >
                        Missed
                        <span>(Left Arrow)</span>
                      </button>
                      <button className="btn btn-got" onClick={() => handleStudyResult(true)}>
                        I knew it
                        <span>(Right Arrow)</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {mode === "recall" && uniqueMissed.length > 0 && (
                      <>
                        <h1 className="instruction-text">Recall Complete</h1>
                        <div className="controls active">
                          <button className="btn btn-next" onClick={startLoop}>
                            {`Drill ${uniqueMissed.length} Misses`}
                          </button>
                        </div>
                      </>
                    )}

                    {mode === "recall" && uniqueMissed.length === 0 && (
                      <>
                        <h1 className="instruction-text">Batch Mastered!</h1>
                        <div className="controls active">
                          <button
                            className="btn btn-quiet"
                            onClick={() => loadBatch(Math.max(currentBatchIndex - 1, 0))}
                            disabled={currentBatchIndex === 0}
                          >
                            Previous Batch
                          </button>
                          <button
                            className="btn btn-next"
                            onClick={() =>
                              loadBatch(
                                Math.min(currentBatchIndex + 1, Math.max(batchCount - 1, 0)),
                              )
                            }
                            disabled={currentBatchIndex >= batchCount - 1}
                          >
                            Next Batch
                          </button>
                        </div>
                      </>
                    )}

                    {mode === "loop" && uniqueLoopMisses.length > 0 && (
                      <>
                        <h1 className="instruction-text">Keep Going</h1>
                        <div className="controls active">
                          <button className="btn btn-next" onClick={retryLoop}>
                            {`Retry ${uniqueLoopMisses.length} Misses`}
                          </button>
                        </div>
                      </>
                    )}

                    {mode === "loop" && uniqueLoopMisses.length === 0 && (
                      <>
                        {!hasLoopSource ? (
                          <>
                            <h1 className="instruction-text">No Misses Yet</h1>
                            <div className="controls active">
                              <button className="btn btn-next" onClick={startRecall}>
                                Start Recall
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <h1 className="instruction-text">Loop Complete</h1>
                            <div className="controls active">
                              <button className="btn btn-next" onClick={() => setModeSafe("quiz")}>
                                Start Quiz
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {mode === "quiz" && (
              <>
                {!quizCard ? (
                  <h1 className="instruction-text">No cards match this search.</h1>
                ) : (
                  <div
                    className="quiz-card"
                    onTouchStart={(e) => setTouchStartX(e.changedTouches?.[0]?.screenX ?? 0)}
                    onTouchEnd={(e) => {
                      const endX = e.changedTouches?.[0]?.screenX ?? touchStartX;
                      const threshold = 50;
                      if (touchStartX - endX > threshold) goToQuizIndex(quizIndex + 1);
                      if (endX - touchStartX > threshold) goToQuizIndex(quizIndex - 1);
                    }}
                  >
                    <div className="quiz-progress">
                      {`Card ${quizIndex + 1} of ${orderedCards.length} (#${quizCard.cardNumber})`}
                    </div>
                    <div className="quiz-question">{quizCard.question}</div>
                    <div className="quiz-options">
                      {quizOptions.map((option) => {
                        const isCorrect = option === quizCard.answer;
                        const isSelected = option === quizSelected;
                        let optionClass = "quiz-option";
                        if (quizChecked && isCorrect) optionClass += " correct";
                        if (quizChecked && isSelected && !isCorrect) optionClass += " incorrect";
                        if (!quizChecked && isSelected) optionClass += " selected";
                        return (
                          <button
                            key={option}
                            className={optionClass}
                            onClick={() => setQuizSelected(option)}
                            disabled={quizChecked}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                    <div className="controls active quiz-controls">
                      <button
                        className="btn btn-quiet"
                        onClick={() => goToQuizIndex(quizIndex - 1)}
                        disabled={quizIndex === 0}
                      >
                        Previous
                      </button>
                      <button
                        className="btn btn-next"
                        onClick={checkQuizAnswer}
                        disabled={!quizSelected || quizChecked}
                      >
                        Check Answer
                      </button>
                      <button
                        className="btn btn-quiet"
                        onClick={() => goToQuizIndex(quizIndex + 1)}
                        disabled={quizIndex >= orderedCards.length - 1}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {!isHomeScreen && (
        <>
          <button className="info-btn" onClick={() => setIsHelpOpen((prev) => !prev)}>
            i
          </button>

          <div className={`modal-overlay ${isHelpOpen ? "open" : ""}`}>
            <div className="modal-content">
              <button className="close-modal" onClick={() => setIsHelpOpen(false)}>
                x
              </button>

              <div className="modal-h2">How it Works</div>

              <div className="modal-h3">Controls</div>
              <div className="modal-p">
                <span className="key-tag">SPACE</span> or <strong>Tap</strong> to Flip Card.
              </div>
              <div className="modal-p">
                <span className="key-tag">LEFT</span> or <strong>Swipe Left</strong> if you
                missed it.
              </div>
              <div className="modal-p">
                <span className="key-tag">RIGHT</span> or <strong>Swipe Right</strong> if you
                knew it.
              </div>

              <div className="modal-h3">The Methodology</div>
              <div className="modal-p">
                <strong>1. Exposure:</strong> Review the batch of 8 items. Do not memorize,
                just familiarize.
              </div>
              <div className="modal-p">
                <strong>2. Recall:</strong> Test yourself. We force 2-way recall to ensure
                mastery.
              </div>
              <div className="modal-p">
                <strong>3. Loop:</strong> The system remembers what you missed. You will loop
                through only the missed items until you get them all right.
              </div>
            </div>
          </div>

          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
    </>
  );
}
