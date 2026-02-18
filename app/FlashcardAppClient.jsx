"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import iconNext from "./icon_next.png";
import iconPrevious from "./icon_previous.png";
import iconVerify from "./icon_verify.png";

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

function createClientId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function FlashcardAppClient({ decks }) {
  const deckNames = useMemo(() => Object.keys(decks).sort(), [decks]);
  const [selectedDeckName, setSelectedDeckName] = useState(deckNames[0] ?? "");
  const [activeDeckName, setActiveDeckName] = useState("");
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [userSession, setUserSession] = useState(null);
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
  const sessionIdRef = useRef("");
  const fingerprintIdRef = useRef("");
  const questionStartAtRef = useRef(0);
  const modeEnterAtRef = useRef(0);
  const previousModeRef = useRef("");
  const searchDebounceRef = useRef(null);
  const exposureBatchEnterAtRef = useRef(0);
  const exposureBatchIdRef = useRef("");
  const recallCardShownAtRef = useRef(0);
  const recallLoggedIdsRef = useRef(new Set());
  const loopAttemptCountsRef = useRef(new Map());
  const loopMetricsSentRef = useRef(false);

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

  function getTelemetryBase() {
    return {
      session_id: sessionIdRef.current,
      fingerprint_id: fingerprintIdRef.current,
      user_id: userSession?.userId ?? null,
      deck_name: activeDeckName || null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      language: typeof navigator !== "undefined" ? navigator.language : null,
      timezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : null,
      screen_width: typeof window !== "undefined" ? window.innerWidth : null,
      screen_height: typeof window !== "undefined" ? window.innerHeight : null,
      referrer_url: typeof document !== "undefined" ? document.referrer || null : null,
    };
  }

  async function logoutUser() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setUserSession(null);
    }
  }

  function trackEvents(events, options = {}) {
    if (!events?.length || !sessionIdRef.current || !fingerprintIdRef.current) {
      return;
    }

    if (options?.beacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ events })], { type: "application/json" });
      navigator.sendBeacon("/api/telemetry", blob);
      return;
    }

    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
    }).catch(() => {
      // Fail silently to avoid blocking quiz flow.
    });
  }

  function trackModeDuration(modeName, startedAt) {
    if (!modeName || !startedAt) return;
    const durationSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    if (durationSeconds <= 0) return;

    trackEvents([
      {
        ...getTelemetryBase(),
        type: "session_log",
        mode: modeName,
        duration_seconds: durationSeconds,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

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
    recallLoggedIdsRef.current = new Set();
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
    loopAttemptCountsRef.current = new Map();
    loopMetricsSentRef.current = false;
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

    if (mode === "recall") {
      const elapsedMs = Math.max(0, Date.now() - (recallCardShownAtRef.current || Date.now()));
      trackEvents([
        {
          ...getTelemetryBase(),
          type: "card_timing",
          card_id: String(currentStudyCard.cardNumber),
          time_to_flip_ms: elapsedMs,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

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

    const telemetryBatch = [];
    if (mode === "recall" && !recallLoggedIdsRef.current.has(currentStudyCard.cardNumber)) {
      recallLoggedIdsRef.current.add(currentStudyCard.cardNumber);
      telemetryBatch.push({
        ...getTelemetryBase(),
        type: "quiz_result",
        card_id: String(currentStudyCard.cardNumber),
        batch_id: `${activeDeckName || "deck"}_batch_${currentBatchIndex + 1}`,
        is_correct: Boolean(success),
        phase: "recall",
        timestamp: new Date().toISOString(),
      });
    }

    if (success) {
      telemetryBatch.push({
        ...getTelemetryBase(),
        type: "mastery_log",
        card_id: String(currentStudyCard.cardNumber),
        marked_known: true,
        timestamp: new Date().toISOString(),
      });
    }

    if (telemetryBatch.length) {
      trackEvents(telemetryBatch);
    }

    window.setTimeout(() => {
      setStudyIndex((prev) => prev + 1);
      setStudyFlipped(false);
      setStudySwipeClass("");
    }, 300);
  }

  function toggleGridCard(cardNumber) {
    setGridFlips((prev) => ({ ...prev, [cardNumber]: !prev[cardNumber] }));
    trackEvents([
      {
        ...getTelemetryBase(),
        type: "card_interaction",
        card_id: String(cardNumber),
        interaction_type: "flip",
        phase: "grid",
        action: "flip",
        timestamp: new Date().toISOString(),
      },
    ]);
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
    questionStartAtRef.current = Date.now();
    updateQuizOptions(bounded);
  }

  function checkQuizAnswer() {
    if (!quizSelected || !quizCard) return;
    const now = Date.now();
    const elapsedMs = Math.max(0, now - (questionStartAtRef.current || now));
    const isCorrect = quizSelected === quizCard.answer;
    const base = getTelemetryBase();

    trackEvents([
      {
        ...base,
        type: "quiz_attempt",
        card_id: String(quizCard.cardNumber),
        is_correct: isCorrect,
        selected_answer_id: quizSelected,
        timestamp: new Date(now).toISOString(),
      },
      {
        ...base,
        type: "quiz_timing",
        card_id: String(quizCard.cardNumber),
        time_to_answer_ms: elapsedMs,
        timestamp: new Date(now).toISOString(),
      },
    ]);

    setQuizChecked(true);
  }

  function retryLoop() {
    const retryNumbers = [...new Set(loopMisses)];
    const retryCards = currentBatchData.filter((card) => retryNumbers.includes(card.cardNumber));
    setMissedItems(retryNumbers);
    setLoopMisses([]);
    setMode("loop");
    loopAttemptCountsRef.current = new Map();
    loopMetricsSentRef.current = false;
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
    if (mode !== "recall" && mode !== "loop") return;
    if (!currentStudyCard || studyIndex >= studyQueue.length) return;
    recallCardShownAtRef.current = Date.now();

    if (mode === "loop") {
      const key = String(currentStudyCard.cardNumber);
      const previous = loopAttemptCountsRef.current.get(key) ?? 0;
      loopAttemptCountsRef.current.set(key, previous + 1);
    }
  }, [mode, currentStudyCard, studyIndex, studyQueue.length]);

  useEffect(() => {
    if (isHomeScreen) return;
    if (mode !== "loop") return;
    if (!studyQueue.length || studyIndex < studyQueue.length) return;
    if (loopMetricsSentRef.current) return;

    const batchId = `${activeDeckName || "deck"}_batch_${currentBatchIndex + 1}`;
    const events = Array.from(loopAttemptCountsRef.current.entries()).map(([cardId, attempts]) => ({
      ...getTelemetryBase(),
      type: "loop_metric",
      card_id: cardId,
      batch_id: batchId,
      attempts_count: attempts,
      timestamp: new Date().toISOString(),
    }));

    if (events.length) {
      trackEvents(events);
    }
    loopMetricsSentRef.current = true;
  }, [mode, studyIndex, studyQueue.length, isHomeScreen, currentBatchIndex, activeDeckName]);

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
    if (typeof window === "undefined") return;

    const existingFingerprint = window.localStorage.getItem("recall_fingerprint_id");
    const fingerprintId = existingFingerprint || createClientId("fp");
    if (!existingFingerprint) {
      window.localStorage.setItem("recall_fingerprint_id", fingerprintId);
    }
    fingerprintIdRef.current = fingerprintId;

    const existingSession = window.sessionStorage.getItem("recall_session_id");
    const sessionId = existingSession || createClientId("session");
    if (!existingSession) {
      window.sessionStorage.setItem("recall_session_id", sessionId);
    }
    sessionIdRef.current = sessionId;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadUserSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const json = await response.json();
        if (!cancelled && json?.authenticated && json?.user) {
          setUserSession(json.user);
        }
      } catch {
        // ignore
      }
    }
    loadUserSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isHomeScreen) {
      trackModeDuration(previousModeRef.current, modeEnterAtRef.current);
      previousModeRef.current = "";
      modeEnterAtRef.current = 0;
      return;
    }

    if (!previousModeRef.current) {
      previousModeRef.current = mode;
      modeEnterAtRef.current = Date.now();
      return;
    }

    if (previousModeRef.current !== mode) {
      trackModeDuration(previousModeRef.current, modeEnterAtRef.current);
      previousModeRef.current = mode;
      modeEnterAtRef.current = Date.now();
    }
  }, [mode, isHomeScreen]);

  useEffect(() => {
    if (isHomeScreen || !searchQuery.trim()) return;

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = window.setTimeout(() => {
      const eventType = mode === "reference" ? "reference_view" : "search_log";
      trackEvents([
        {
          ...getTelemetryBase(),
          type: eventType,
          mode,
          search_term: searchQuery.trim(),
          alpha_code: mode === "reference" ? searchQuery.trim() : null,
          timestamp: new Date().toISOString(),
        },
      ]);
    }, 500);

    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, mode, isHomeScreen]);

  useEffect(() => {
    if (isHomeScreen || mode !== "exposure") {
      if (exposureBatchEnterAtRef.current && exposureBatchIdRef.current) {
        const durationSeconds = Math.max(
          0,
          Math.floor((Date.now() - exposureBatchEnterAtRef.current) / 1000),
        );
        if (durationSeconds > 0) {
          trackEvents([
            {
              ...getTelemetryBase(),
              type: "phase_log",
              batch_id: exposureBatchIdRef.current,
              phase: "exposure",
              duration_seconds: durationSeconds,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
      exposureBatchEnterAtRef.current = 0;
      exposureBatchIdRef.current = "";
      return;
    }

    const nextBatchId = `${activeDeckName || "deck"}_batch_${currentBatchIndex + 1}`;
    if (!exposureBatchEnterAtRef.current) {
      exposureBatchEnterAtRef.current = Date.now();
      exposureBatchIdRef.current = nextBatchId;
      return;
    }

    if (exposureBatchIdRef.current !== nextBatchId) {
      const durationSeconds = Math.max(
        0,
        Math.floor((Date.now() - exposureBatchEnterAtRef.current) / 1000),
      );
      if (durationSeconds > 0) {
        trackEvents([
          {
            ...getTelemetryBase(),
            type: "phase_log",
            batch_id: exposureBatchIdRef.current,
            phase: "exposure",
            duration_seconds: durationSeconds,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
      exposureBatchEnterAtRef.current = Date.now();
      exposureBatchIdRef.current = nextBatchId;
    }
  }, [mode, currentBatchIndex, isHomeScreen, activeDeckName]);

  useEffect(() => {
    if (isHomeScreen) return undefined;

    const sendLoopAbandon = () => {
      if (mode !== "loop") return;

      const batchId = `${activeDeckName || "deck"}_batch_${currentBatchIndex + 1}`;
      trackEvents(
        [
          {
            ...getTelemetryBase(),
            type: "session_abandon",
            batch_id: batchId,
            phase: "loop",
            timestamp: new Date().toISOString(),
          },
        ],
        { beacon: true },
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendLoopAbandon();
      }
    };

    window.addEventListener("beforeunload", sendLoopAbandon);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", sendLoopAbandon);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mode, isHomeScreen, activeDeckName, currentBatchIndex]);

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
            <h1 className="instruction-text">Recall | Mastery Training</h1>
            <p className="home-subtext">
              What would you like to learn today?
            </p>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              {userSession ? (
                <>
                  <span style={{ color: "#666", fontSize: "13px" }}>
                    Signed in as {userSession.email}
                  </span>
                  <button className="btn btn-quiet" onClick={logoutUser}>
                    Sign Out
                  </button>
                </>
              ) : (
                <Link href="/auth" style={{ color: "#0071e3", fontSize: "14px" }}>
                  Sign in or create account
                </Link>
              )}
            </div>
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

                <div className="controls active exposure-controls">
                  <button
                    className="btn btn-quiet"
                    onClick={() => loadBatch(Math.max(currentBatchIndex - 1, 0))}
                    disabled={currentBatchIndex === 0}
                  >
                    <Image className="footer-btn-icon" src={iconPrevious} alt="" />
                    <span className="footer-btn-text">Previous Batch</span>
                  </button>
                  <button className="btn btn-next" onClick={startRecall}>
                    <Image className="footer-btn-icon" src={iconVerify} alt="" />
                    <span className="footer-btn-text">Start Recall</span>
                  </button>
                  <button
                    className="btn btn-quiet"
                    onClick={() =>
                      loadBatch(Math.min(currentBatchIndex + 1, Math.max(batchCount - 1, 0)))
                    }
                    disabled={currentBatchIndex >= batchCount - 1}
                  >
                    <Image className="footer-btn-icon" src={iconNext} alt="" />
                    <span className="footer-btn-text">Next Batch</span>
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
                        <Image className="footer-btn-icon" src={iconPrevious} alt="" />
                        <span className="footer-btn-text">Previous</span>
                      </button>
                      <button
                        className="btn btn-next"
                        onClick={checkQuizAnswer}
                        disabled={!quizSelected || quizChecked}
                      >
                        <Image className="footer-btn-icon" src={iconVerify} alt="" />
                        <span className="footer-btn-text">Check Answer</span>
                      </button>
                      <button
                        className="btn btn-quiet"
                        onClick={() => goToQuizIndex(quizIndex + 1)}
                        disabled={quizIndex >= orderedCards.length - 1}
                      >
                        <Image className="footer-btn-icon" src={iconNext} alt="" />
                        <span className="footer-btn-text">Next</span>
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

              <div className="modal-h3">The 3 Viewing Modes</div>
              <div className="modal-p">
                <strong>Reference:</strong> The master list containing all codes and
                definitions. Use this for quick lookups without testing yourself.
              </div>
              <div className="modal-p">
                <strong>Grid Mode:</strong> A bird's-eye view of flip-cards. Best for rapid
                scanning and initial familiarization.
              </div>
              <div className="modal-p">
                <strong>Quiz Mode:</strong> The active testing interface. Focuses on one item at
                a time (either Flashcard or Multiple Choice style) for deep recall.
              </div>

              <div className="modal-h3">The Methodology (Progression)</div>
              <div className="modal-p">
                <strong>Exposure:</strong> Start in Grid Mode. Read through the batch of items. Do
                not memorize yet; just familiarize yourself with the content.
              </div>
              <div className="modal-p">
                <strong>Recall:</strong> Switch to Quiz Mode. The answer is hidden. Force yourself
                to produce the answer mentally before checking.
              </div>
              <div className="modal-p">
                <strong>Loop:</strong> The system tracks what you know. Use the "I got it" button
                to remove items you have mastered. Loop through the remaining items until your
                progress bar hits 100%.
              </div>

              <div className="modal-h3">Controls</div>
              <div className="modal-p">
                <strong>Flip / Check Answer:</strong> <span className="key-tag">SPACE</span> or
                <strong> Tap the card</strong>.
              </div>
              <div className="modal-p">
                <strong>Next / Missed:</strong> <span className="key-tag">LEFT ARROW</span> or
                <strong> Swipe Left</strong> (Keeps item in the loop).
              </div>
              <div className="modal-p">
                <strong>I Got It / Known:</strong> <span className="key-tag">RIGHT ARROW</span> or
                <strong> Swipe Right</strong> (Removes item from the loop).
              </div>
              <div className="modal-p">
                <strong>Search:</strong> Use the top bar to filter specific codes or terms
                instantly.
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
