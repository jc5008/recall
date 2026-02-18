# Recall Analytics + Reporting Plan

## Goal

Enable admins to generate reports on employee progress and identify problem areas where many users struggle.

## Delivery Phases

1. **Data foundation**
   - Add Neon SQL connection (done via `.env.local`).
   - Create analytics schema and migration workflow.
   - Add server-side write API for telemetry events.
2. **Client instrumentation**
   - Track events in each mode (`reference`, `grid`, `quiz`, `exposure`, `recall`, `loop`).
   - Add session lifecycle tracking and mode duration tracking.
   - Add robust user/session identifiers.
3. **Reporting layer**
   - Add SQL views/materialized views for dashboards and exports.
   - Add admin report pages and filtering (user, deck, date range, mode).
4. **Quality + governance**
   - Backfill tests.
   - Validate event integrity, dedupe strategy, and performance.

## Progress Update

- **Completed**
  - Neon integration configured via `.env.local`.
  - Migration framework added (`scripts/migrate.js`, `db/migrations/*`).
  - Core telemetry schema and extended mode schema applied:
    - `001_init_telemetry.sql`
    - `002_extended_mode_telemetry.sql`
  - Telemetry ingestion API added: `app/api/telemetry/route.js`.
  - Client telemetry pipeline added in `app/FlashcardAppClient.jsx`:
    - persistent `session_id` and `fingerprint_id`
    - mode duration logs (`session_logs`) across app modes
    - search/reference logging (`search_logs`, `reference_views`)
    - grid flips (`card_interactions`)
    - quiz attempts and response timing (`quiz_attempts`, `quiz_timing`)
    - exposure batch dwell (`phase_logs`)
    - recall first-pass + timing (`quiz_results`, `card_timing`)
    - loop struggle metrics + known marks (`loop_metrics`, `mastery_logs`)
    - loop drop-off on unload/visibility (`session_abandons`)
  - Admin-only reporting endpoints added:
    - `GET /api/admin/reports/top-difficult-cards`
    - `GET /api/admin/reports/employee-progress`
    - protected by server-side admin session (HTTP-only cookie)
  - Admin auth endpoints added:
    - `POST /api/admin/login`
    - `POST /api/admin/logout`
    - `GET /api/admin/session`
  - User auth endpoints and page added:
    - `POST /api/auth/register`
    - `POST /api/auth/login`
    - `POST /api/auth/logout`
    - `GET /api/auth/session`
    - `app/auth/page.jsx`
  - Telemetry now binds `user_id` from server-verified user session cookie.
  - Admin report page added: `app/admin/reports/page.jsx`
  - Automated tests added:
    - telemetry payload validation
    - report query builders
- **In Progress / Remaining**
  - Expand admin report filters (date range, team, deck comparisons).
  - Privacy/consent controls and retention/anonymization policy.
  - Add API integration tests for report routes against seeded test DB.

## SQL Data Model (Initial)

### Core Identity

- `Users`
  - `user_id` (PK), `email`, `created_at`, `is_active`
- `UserDevices`
  - `fingerprint_id` (PK), `user_id` (nullable FK), `device_id`, `first_seen_at`, `last_seen_at`
- `Sessions`
  - `session_id` (PK), `user_id` (nullable FK), `fingerprint_id`, `started_at`, `ended_at`, `ip_address`, `user_agent`, `timezone`, `language`, `screen_width`, `screen_height`, `referrer_url`, `utm_source`, `utm_medium`, `utm_campaign`

### Mode + Interaction Logs

- `SearchLogs`  
  `(id, session_id, user_id, fingerprint_id, deck_name, mode, search_term, timestamp)`
- `ReferenceViews`  
  `(id, session_id, user_id, fingerprint_id, deck_name, alpha_code, timestamp)`
- `SessionLogs`  
  `(id, session_id, user_id, fingerprint_id, deck_name, mode, duration_seconds, timestamp)`
- `CardInteractions`  
  `(id, session_id, user_id, fingerprint_id, deck_name, card_id, interaction_type, phase, action, timestamp)`
- `QuizAttempts`  
  `(id, session_id, user_id, fingerprint_id, deck_name, card_id, is_correct, selected_answer_id, timestamp)`
- `MasteryLogs`  
  `(id, session_id, user_id, fingerprint_id, deck_name, card_id, marked_known, timestamp)`
- `QuizTiming`  
  `(id, session_id, user_id, fingerprint_id, deck_name, card_id, time_to_answer_ms, timestamp)`
- `PhaseLogs`  
  `(id, session_id, user_id, fingerprint_id, deck_name, batch_id, phase, duration_seconds, timestamp)`
- `QuizResults`  
  `(id, session_id, user_id, fingerprint_id, deck_name, card_id, batch_id, is_correct, phase, timestamp)`
- `CardTiming`  
  `(id, session_id, user_id, fingerprint_id, deck_name, card_id, time_to_flip_ms, timestamp)`
- `LoopMetrics`  
  `(id, session_id, user_id, fingerprint_id, deck_name, card_id, batch_id, attempts_count, timestamp)`
- `SessionAbandons`  
  `(id, session_id, user_id, fingerprint_id, deck_name, batch_id, phase, timestamp)`

## Instrumentation Matrix (Per Mode)

### 1) Reference View Tracking

- **Search Queries**
  - SQL: `INSERT INTO SearchLogs (user_id, fingerprint_id, search_term, timestamp)`
  - Use: identify terms users look up repeatedly.
- **Filter Usage**
  - SQL: `INSERT INTO ReferenceViews (user_id, fingerprint_id, alpha_code, timestamp)`
  - Use: identify frequently referenced product lines.
- **Session Duration**
  - SQL: `INSERT INTO SessionLogs (user_id, fingerprint_id, mode, duration_seconds)`
  - Use: confirm users are spending time in reference learning.

### 2) Grid Mode Tracking

- **Card Flips**
  - SQL: `INSERT INTO CardInteractions (user_id, fingerprint_id, card_id, interaction_type, timestamp)`
  - Use: surface confusing cards with high re-open behavior.
- **Session Duration**
  - SQL: `INSERT INTO SessionLogs (user_id, fingerprint_id, mode, duration_seconds)`
  - Use: verify exposure engagement time.

### 3) Quiz Mode Tracking

- **Answer Accuracy**
  - SQL: `INSERT INTO QuizAttempts (user_id, fingerprint_id, card_id, is_correct, selected_answer_id, timestamp)`
  - Use: per-card difficulty and quality scoring.
- **Session Duration**
  - SQL: `INSERT INTO SessionLogs (user_id, fingerprint_id, mode, duration_seconds)`
- **"I Got It" Marks**
  - SQL: `INSERT INTO MasteryLogs (user_id, fingerprint_id, card_id, marked_known, timestamp)`
  - Use: mastery progress by user/card/deck.
- **Response Time**
  - SQL: `INSERT INTO QuizTiming (user_id, fingerprint_id, card_id, time_to_answer_ms)`
  - Use: confidence and automaticity analysis.

### 4) Exposure Mode Tracking

- **Batch Duration**
  - SQL: `INSERT INTO PhaseLogs (user_id, fingerprint_id, batch_id, phase, duration_seconds, timestamp)`
  - Use: correlate exposure dwell time with later recall outcomes.
- **Passive Flips**
  - SQL: `INSERT INTO CardInteractions (user_id, fingerprint_id, card_id, interaction_type, phase, action, timestamp)`
  - Use: identify hard-to-scan content.
- **Session Duration**
  - SQL: `INSERT INTO SessionLogs (user_id, fingerprint_id, mode, duration_seconds)`

### 5) Recall Mode Tracking

- **First-Attempt Accuracy**
  - SQL: `INSERT INTO QuizResults (user_id, fingerprint_id, card_id, batch_id, is_correct, phase)`
  - Use: clean first-pass knowledge signal.
- **Time-to-Flip**
  - SQL: `INSERT INTO CardTiming (user_id, fingerprint_id, card_id, time_to_flip_ms)`
  - Use: confidence proxy.
- **Session Duration**
  - SQL: `INSERT INTO SessionLogs (user_id, fingerprint_id, mode, duration_seconds)`

### 6) Loop Mode Tracking

- **Loop Iterations**
  - SQL: `INSERT INTO LoopMetrics (user_id, fingerprint_id, card_id, batch_id, attempts_count)`
  - Use: struggle score per card/user.
- **Drop-off Rate**
  - SQL: `INSERT INTO SessionAbandons (user_id, fingerprint_id, batch_id, phase, timestamp)`
  - Use: identify remediation friction in loop.
- **Session Duration**
  - SQL: `INSERT INTO SessionLogs (user_id, fingerprint_id, mode, duration_seconds)`

## User Session Identification Strategy

### 1) Explicit User Identification

- `user_id` (admin-provisioned UID)
- `email`

### 2) Device and Browser Characteristics (Fingerprinting)

- First-party cookies (`session_id`, `visitor_id`)
- Device ID / Advertising ID (when available on mobile clients)
- IP address
- User-Agent
- Screen resolution
- Time zone and language

### 3) Behavioral and Contextual Signals

- Referrer URL
- UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`)

## Admin Reporting Outputs

1. **Employee Progress Report**
   - `% mastered` by deck, by user, by date range
   - time spent per mode and per session
2. **Problem Area Report**
   - lowest-accuracy cards
   - highest loop iterations
   - highest lookup/search frequency
3. **Training Effectiveness Report**
   - exposure duration vs recall/quiz success
   - response-time trends by user/team

## Technical Next Steps (Implementation Checklist)

- [x] Add SQL migration scripts for all tables and indexes.
- [x] Add `lib/db` Neon client + pooled query utility.
- [x] Add `/api/telemetry` endpoint (batch insert support).
- [x] Add client telemetry utility (`trackEvent`) with retries/debounce.
- [x] Instrument all mode interactions and timers.
- [x] Add admin-only report API endpoints and pages.
- [x] Add automated tests for telemetry payload validation and report queries.
