"use client";

import Link from "next/link";
import { useState } from "react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setMessage("");
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email: email.trim(), password }
          : { email: email.trim(), password, displayName: displayName.trim() };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Authentication failed.");
      }

      setMessage(mode === "login" ? "Signed in successfully." : "Account created successfully.");
      setTimeout(() => {
        window.location.href = "/";
      }, 400);
    } catch (e) {
      setError(e.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "24px", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          padding: "24px",
        }}
      >
        <h1 style={{ margin: "0 0 10px" }}>{mode === "login" ? "Sign In" : "Create Account"}</h1>
        <p style={{ margin: "0 0 16px", color: "#666" }}>
          {mode === "login"
            ? "Sign in to link your training telemetry to your account."
            : "Create an account for tracked progress across sessions."}
        </p>

        <div style={{ display: "grid", gap: "10px" }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            style={inputStyle}
          />
          {mode === "register" && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              type="text"
              placeholder="Display name (optional)"
              style={inputStyle}
            />
          )}
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            style={inputStyle}
          />

          <button onClick={submit} disabled={loading} style={buttonStyle}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>

        {error && <p style={{ color: "#b00020", marginTop: "12px" }}>{error}</p>}
        {message && <p style={{ color: "#0a7a31", marginTop: "12px" }}>{message}</p>}

        <div style={{ marginTop: "14px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setMode("login")}
            style={mode === "login" ? tabActiveStyle : tabStyle}
          >
            Login
          </button>
          <button
            onClick={() => setMode("register")}
            style={mode === "register" ? tabActiveStyle : tabStyle}
          >
            Register
          </button>
          <Link href="/" style={{ marginLeft: "auto", color: "#0071e3", textDecoration: "none" }}>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

const inputStyle = {
  padding: "10px",
  border: "1px solid rgba(118, 118, 128, 0.28)",
  borderRadius: "10px",
  fontSize: "14px",
};

const buttonStyle = {
  padding: "10px 14px",
  border: "none",
  borderRadius: "10px",
  background: "#0071e3",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const tabStyle = {
  padding: "8px 10px",
  border: "1px solid rgba(118,118,128,0.28)",
  borderRadius: "999px",
  background: "#fff",
  cursor: "pointer",
};

const tabActiveStyle = {
  ...tabStyle,
  background: "rgba(0,113,227,0.1)",
  borderColor: "#0071e3",
};
