"use client";

import { useEffect, useMemo, useState } from "react";

export default function AdminReportsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [deckName, setDeckName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [difficultCards, setDifficultCards] = useState([]);
  const [employeeProgress, setEmployeeProgress] = useState([]);

  const hasData = useMemo(
    () => difficultCards.length > 0 || employeeProgress.length > 0,
    [difficultCards.length, employeeProgress.length],
  );

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        if (!cancelled && response.ok) {
          setAuthenticated(true);
        }
      } catch {
        // ignore session check errors
      }
    }
    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login() {
    if (!password.trim()) {
      setError("Enter admin password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        throw new Error("Login failed.");
      }
      setAuthenticated(true);
      setPassword("");
      await loadReports();
    } catch (e) {
      setError(e.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setDifficultCards([]);
    setEmployeeProgress([]);
  }

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      const deckParam = deckName.trim() ? `&deck=${encodeURIComponent(deckName.trim())}` : "";
      const [difficultRes, progressRes] = await Promise.all([
        fetch(`/api/admin/reports/top-difficult-cards?limit=25&minAttempts=2${deckParam}`, {
          cache: "no-store",
        }),
        fetch(`/api/admin/reports/employee-progress?limit=50${deckParam}`, {
          cache: "no-store",
        }),
      ]);

      if (difficultRes.status === 401 || progressRes.status === 401) {
        setAuthenticated(false);
        throw new Error("Not authenticated. Log in to continue.");
      }
      if (!difficultRes.ok || !progressRes.ok) {
        throw new Error("Unable to load reports.");
      }

      const difficultJson = await difficultRes.json();
      const progressJson = await progressRes.json();

      setDifficultCards(Array.isArray(difficultJson.data) ? difficultJson.data : []);
      setEmployeeProgress(Array.isArray(progressJson.data) ? progressJson.data : []);
    } catch (e) {
      setError(e.message || "Failed to load reports.");
      setDifficultCards([]);
      setEmployeeProgress([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authenticated) {
      loadReports();
    }
    // Intentionally trigger when auth state flips true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  return (
    <main style={{ padding: "24px", alignItems: "stretch" }}>
      <h1 style={{ margin: "0 0 12px" }}>Admin Reports</h1>
      <p style={{ margin: "0 0 16px", color: "#666" }}>
        Reports are protected by a server-side admin session.
      </p>

      {!authenticated ? (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Admin password"
            style={{ minWidth: "260px", padding: "10px" }}
          />
          <button onClick={login} disabled={loading} style={{ padding: "10px 14px" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
          <input
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Deck filter (optional)"
            style={{ minWidth: "220px", padding: "10px" }}
          />
          <button onClick={loadReports} disabled={loading} style={{ padding: "10px 14px" }}>
            {loading ? "Loading..." : "Load Reports"}
          </button>
          <button onClick={logout} disabled={loading} style={{ padding: "10px 14px" }}>
            Sign Out
          </button>
        </div>
      )}

      {error && <p style={{ color: "#b00020", margin: "0 0 16px" }}>{error}</p>}

      {!hasData && !loading && !error && (
        <p style={{ color: "#666", margin: 0 }}>No data loaded yet.</p>
      )}

      {difficultCards.length > 0 && (
        <>
          <h2 style={{ marginTop: "8px" }}>Top Difficult Cards</h2>
          <div style={{ overflowX: "auto", marginBottom: "18px" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Deck</th>
                  <th style={thStyle}>Card</th>
                  <th style={thStyle}>Attempts</th>
                  <th style={thStyle}>Correct</th>
                  <th style={thStyle}>Accuracy %</th>
                </tr>
              </thead>
              <tbody>
                {difficultCards.map((row) => (
                  <tr key={`${row.deck_name}-${row.card_id}`}>
                    <td style={tdStyle}>{row.deck_name}</td>
                    <td style={tdStyle}>{row.card_id}</td>
                    <td style={tdStyle}>{row.attempts}</td>
                    <td style={tdStyle}>{row.correct_count}</td>
                    <td style={tdStyle}>{row.accuracy_pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {employeeProgress.length > 0 && (
        <>
          <h2>Employee Progress</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Deck</th>
                  <th style={thStyle}>Mastered Cards</th>
                  <th style={thStyle}>Last Mastered</th>
                </tr>
              </thead>
              <tbody>
                {employeeProgress.map((row, index) => (
                  <tr key={`${row.user_id}-${row.deck_name}-${index}`}>
                    <td style={tdStyle}>{row.user_id}</td>
                    <td style={tdStyle}>{row.deck_name}</td>
                    <td style={tdStyle}>{row.mastered_cards}</td>
                    <td style={tdStyle}>{row.last_mastered_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "8px",
  borderBottom: "1px solid #ddd",
  fontWeight: 700,
  fontSize: "13px",
};

const tdStyle = {
  textAlign: "left",
  padding: "8px",
  borderBottom: "1px solid #eee",
  fontSize: "13px",
};
