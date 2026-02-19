"use client";

import { useEffect, useMemo, useState } from "react";

const MODE_OPTIONS = [
  { id: "reference", label: "Reference Reports" },
  { id: "grid", label: "Grid Reports" },
  { id: "quiz", label: "Quiz Reports" },
  { id: "exposure", label: "Exposure Reports" },
  { id: "recall", label: "Recall Reports" },
  { id: "loop", label: "Loop Reports" },
];

export default function AdminReportsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [deckName, setDeckName] = useState("");
  const [activeMode, setActiveMode] = useState("reference");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportSections, setReportSections] = useState([]);

  const hasData = useMemo(
    () =>
      reportSections.some((section) => Array.isArray(section.rows) && section.rows.length > 0),
    [reportSections],
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
      await loadModeReport("reference");
    } catch (e) {
      setError(e.message || "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setReportSections([]);
  }

  async function loadModeReport(mode) {
    setLoading(true);
    setError("");
    setActiveMode(mode);

    try {
      const deckParam = deckName.trim() ? `&deck=${encodeURIComponent(deckName.trim())}` : "";
      const response = await fetch(`/api/admin/reports/mode/${mode}?limit=25${deckParam}`, {
        cache: "no-store",
      });

      if (response.status === 401) {
        setAuthenticated(false);
        throw new Error("Not authenticated. Log in to continue.");
      }
      if (!response.ok) {
        throw new Error("Unable to load reports.");
      }

      const json = await response.json();
      setReportSections(Array.isArray(json.sections) ? json.sections : []);
    } catch (e) {
      setError(e.message || "Failed to load reports.");
      setReportSections([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveMode() {
    await loadModeReport(activeMode);
  }

  useEffect(() => {
    if (authenticated) {
      loadModeReport("reference");
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
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
          <input
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Deck filter (optional)"
            style={{ minWidth: "220px", padding: "10px" }}
          />
          <button onClick={loadActiveMode} disabled={loading} style={{ padding: "10px 14px" }}>
            {loading ? "Loading..." : "Reload Active Report"}
          </button>
          <button onClick={logout} disabled={loading} style={{ padding: "10px 14px" }}>
            Sign Out
          </button>
        </div>
      )}

      {error && <p style={{ color: "#b00020", margin: "0 0 16px" }}>{error}</p>}

      {authenticated && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
          {MODE_OPTIONS.map((mode) => (
            <button
              key={mode.id}
              onClick={() => loadModeReport(mode.id)}
              disabled={loading}
              style={{
                padding: "10px 12px",
                fontWeight: mode.id === activeMode ? 700 : 500,
                border: mode.id === activeMode ? "2px solid #222" : "1px solid #bbb",
                background: mode.id === activeMode ? "#f5f5f5" : "#fff",
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {!hasData && !loading && !error && (
        <p style={{ color: "#666", margin: 0 }}>No data loaded yet.</p>
      )}

      {reportSections.map((section) => (
        <ReportSection key={section.key} section={section} />
      ))}
    </main>
  );
}

function ReportSection({ section }) {
  const rows = Array.isArray(section.rows) ? section.rows : [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <>
      <h2 style={{ marginTop: "10px" }}>{section.title}</h2>
      {rows.length === 0 ? (
        <p style={{ color: "#666", marginTop: 0 }}>No rows found for current filters.</p>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: "18px" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} style={thStyle}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${section.key}-${index}`}>
                  {columns.map((column) => (
                    <td key={`${section.key}-${index}-${column}`} style={tdStyle}>
                      {formatCellValue(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function formatCellValue(value) {
  if (value == null) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
