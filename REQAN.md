# CareerLinkAI Requirement Analysis

## 1. Purpose

This document defines the functional and non-functional requirements of CareerLinkAI, a senior-high career guidance platform for students and counselors. It describes what the system must do, what quality attributes it must satisfy, and the expected operating constraints.

## 2. System Scope

CareerLinkAI provides:

1. Role-based account management for students and counselors.
2. Student onboarding, assessment, and recommendation generation.
3. Counselor tools for department management, student monitoring, and event management.
4. AI-assisted guidance for students and AI-assisted event draft generation for counselors.
5. Notification and activity tracking for collaboration workflows.

Out of scope for the current release:

1. Native mobile applications.
2. Offline assessment completion.
3. External SIS/LMS integration.
4. Manual counselor assignment workflows outside invitation/join-code model.

## 3. Stakeholders and User Roles

| Role | Description | Primary Goals |
|---|---|---|
| Student | Senior high school learner | Complete profile and assessments, receive recommendations, join departments, respond to events, use AI counselor |
| Counselor | Guidance counselor/department owner | Create departments, generate invitation codes, monitor student progress and outcomes, create events, analyze trends |
| System Administrator (operational) | Platform maintainer | Configure Cloudflare resources, deploy releases, manage secrets |

## 4. Assumptions and Constraints

1. The platform runs on Cloudflare Workers with D1, KV, Durable Objects, Vectorize, and Workers AI bindings available.
2. Frontend is served as Worker assets and communicates with JSON APIs over HTTPS.
3. Student sign-up requires a valid invitation code tied to an existing counselor department.
4. Assessment results depend on complete profile data and complete RIASEC/SCCT responses.
5. Email delivery uses Resend when `RESEND_API_KEY` is configured.

## 5. Functional Requirements

### 5.1 Authentication and Account Security

| ID | Requirement |
|---|---|
| FR-AUTH-01 | The system must allow user sign-up for `student` and `counselor` roles. |
| FR-AUTH-02 | The system must enforce strong passwords (minimum length and complexity rules). |
| FR-AUTH-03 | The system must require policy acceptance during sign-up. |
| FR-AUTH-04 | The system must verify email addresses before allowing sign-in. |
| FR-AUTH-05 | The system must provide sign-in using email, password, and selected role. |
| FR-AUTH-06 | The system must issue JWT access tokens for authenticated sessions. |
| FR-AUTH-07 | The system must provide a "current user" endpoint for session restoration. |
| FR-AUTH-08 | The system must support password change for authenticated users. |
| FR-AUTH-09 | The system must support forgot-password and reset-password flows using one-time tokens with expiration. |
| FR-AUTH-10 | The system must support resending verification emails without revealing account existence. |
| FR-AUTH-11 | The system must hash stored passwords and must not store raw password values. |
| FR-AUTH-12 | The system must enforce role-based authorization on protected endpoints. |

### 5.2 Student Registration, Onboarding, and Profile

| ID | Requirement |
|---|---|
| FR-STU-01 | The system must require students to provide a valid 6-character invitation code during sign-up. |
| FR-STU-02 | The system must auto-enroll a student into the department associated with the invitation code. |
| FR-STU-03 | The system must capture and update student profile basics: school, grade level, gender, and birthdate. |
| FR-STU-04 | The system must capture and update onboarding profile fields: strand, GWA, and Grade 7-10 Math/English/Science grades. |
| FR-STU-05 | The system must lock strand changes if strand is inherited from invitation and already set. |
| FR-STU-06 | The system must mark profile/onboarding completion state for routing and UX decisions. |
| FR-STU-07 | The system must allow a student to join additional departments using join code links/endpoints. |

### 5.3 Assessment and Recommendation Engine

| ID | Requirement |
|---|---|
| FR-ASMT-01 | The system must provide RIASEC assessment with 48 items and autosave per item. |
| FR-ASMT-02 | The system must provide SCCT assessment with 12 items and autosave per item. |
| FR-ASMT-03 | The system must validate that all required RIASEC and SCCT items are completed before final result generation. |
| FR-ASMT-04 | The system must compute RIASEC dimension averages and Holland code from submitted answers. |
| FR-ASMT-05 | The system must compute SCCT construct scores from submitted answers. |
| FR-ASMT-06 | The system must generate recommendation outputs (courses/careers) using profile + assessment signals. |
| FR-ASMT-07 | The system must persist generated results and provide retrieval via student results endpoint. |
| FR-ASMT-08 | The system must fail with explicit validation errors when prerequisites for result generation are incomplete. |

### 5.4 Counselor Department and Student Monitoring

| ID | Requirement |
|---|---|
| FR-CNS-01 | The system must allow counselors to create departments with strand assignment. |
| FR-CNS-02 | The system must generate unique department join codes. |
| FR-CNS-03 | The system must provide counselor department list with student/completion counts and join URL. |
| FR-CNS-04 | The system must provide department detail including roster and each student's assessment status. |
| FR-CNS-05 | The system must provide counselor access to an authorized student's profile and recommendation result details. |
| FR-CNS-06 | The system must allow counselor profile management (first name, last name, school). |
| FR-CNS-07 | The system must allow counselors to remove a student from a department. |
| FR-CNS-08 | The system must provide counselor activity feed and summary analytics (totals, trends, distributions). |

### 5.5 Event (Seminar) and Invitation Management

| ID | Requirement |
|---|---|
| FR-EVT-01 | The system must allow counselors to create events/seminars for a department with title, schedule, and optional description/venue. |
| FR-EVT-02 | The system must automatically generate invitations for all current department members when an event is created. |
| FR-EVT-03 | The system must allow students to view pending/past invitations. |
| FR-EVT-04 | The system must allow students to respond to invitations with accepted/declined status. |
| FR-EVT-05 | The system must expose seminar-level response breakdown for counselors (accepted/declined/pending). |
| FR-EVT-06 | The system must log counselor activity for event creation and invitation responses. |
| FR-EVT-07 | The system must create and deliver notifications for seminar invitations and responses. |

### 5.6 AI Features

| ID | Requirement |
|---|---|
| FR-AI-01 | The system must provide AI explanation endpoint for students after results are available. |
| FR-AI-02 | The system must provide persistent multi-turn AI counselor chat sessions for students. |
| FR-AI-03 | The system must retrieve contextual knowledge from Vectorize before generating AI answers when available. |
| FR-AI-04 | The system must preserve a safe fallback response when AI generation is unavailable. |
| FR-AI-05 | The system must allow counselors to trigger manual knowledge base seeding. |
| FR-AI-06 | The system must provide counselor AI draft assistance for event details from natural language prompts. |
| FR-AI-07 | The system must persist AI chat history by session and user ownership rules. |

### 5.7 Notifications and Realtime Delivery

| ID | Requirement |
|---|---|
| FR-NOTIF-01 | The system must persist notifications in the database for authenticated users. |
| FR-NOTIF-02 | The system must support unread count and mark-all-read operation. |
| FR-NOTIF-03 | The system must support real-time notification push using WebSocket via Durable Objects. |
| FR-NOTIF-04 | The system must require valid JWT token for WebSocket notification channel connection. |

### 5.8 Operational and Platform Requirements

| ID | Requirement |
|---|---|
| FR-OPS-01 | The system must expose a health endpoint for service status checks. |
| FR-OPS-02 | The system must serve frontend SPA assets from Worker asset binding for non-API routes. |
| FR-OPS-03 | The system must run scheduled knowledge seeding through cron trigger. |
| FR-OPS-04 | The system must support CI-based build-and-deploy pipeline on Linux. |

## 6. Non-Functional Requirements

### 6.1 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All authenticated API access must require bearer JWT validation. |
| NFR-SEC-02 | Passwords must be stored as PBKDF2-SHA256 hashes with per-user salt. |
| NFR-SEC-03 | Password reset and email verification must use opaque random tokens stored as hash only. |
| NFR-SEC-04 | API must enforce role authorization boundaries (`student` vs `counselor`). |
| NFR-SEC-05 | CORS must be restricted to configured frontend origin(s). |
| NFR-SEC-06 | Input validation must reject malformed IDs, statuses, and assessment payloads. |
| NFR-SEC-07 | Rate limiting must protect sensitive endpoints (auth and AI usage). |

### 6.2 Performance and Responsiveness

| ID | Requirement |
|---|---|
| NFR-PERF-01 | Core interactive APIs (auth/profile/assessment CRUD) should return user-perceived fast responses under normal load. |
| NFR-PERF-02 | The system should support incremental autosave for assessment answers to avoid large payload retries. |
| NFR-PERF-03 | AI requests must return bounded responses with token limits and fallback behavior when unavailable. |

### 6.3 Reliability and Data Integrity

| ID | Requirement |
|---|---|
| NFR-REL-01 | Database writes must preserve referential integrity using keys/constraints where defined. |
| NFR-REL-02 | Critical generated artifacts (results, invitations, notifications, chat messages) must be persisted durably. |
| NFR-REL-03 | Duplicate join/enrollment and invitation records should be prevented by uniqueness constraints or idempotent writes. |
| NFR-REL-04 | Error responses must return explicit failure messages without exposing secrets. |

### 6.4 Scalability

| ID | Requirement |
|---|---|
| NFR-SCL-01 | The backend must be horizontally scalable using serverless Worker model. |
| NFR-SCL-02 | RAG knowledge retrieval must operate on vector index instead of full-text full-corpus scan at request time. |
| NFR-SCL-03 | Notification fan-out must support one-to-many delivery via Durable Object session tracking. |

### 6.5 Usability and Accessibility

| ID | Requirement |
|---|---|
| NFR-UX-01 | Navigation must be role-aware and prevent accidental exposure of unauthorized pages. |
| NFR-UX-02 | Validation errors must be explicit and actionable (missing fields, invalid code, incomplete assessment). |
| NFR-UX-03 | Student and counselor workflows must be separated and optimized for their primary tasks. |

### 6.6 Maintainability and Operability

| ID | Requirement |
|---|---|
| NFR-MNT-01 | Codebase must keep frontend and backend separated in monorepo packages. |
| NFR-MNT-02 | API route handling, scoring logic, and AI helpers must remain modularized by concern. |
| NFR-MNT-03 | Deployment must be automated via CI workflow and versioned source control. |
| NFR-MNT-04 | Runtime schema safety should include migration-safe table/column checks where needed. |

## 7. Traceability Matrix (Feature to Requirement Groups)

| Feature | Main Requirement Groups |
|---|---|
| Login and account verification | FR-AUTH, NFR-SEC |
| Invitation code generation and student join | FR-CNS-02, FR-STU-01/02/07, NFR-REL |
| Student monitoring by counselor | FR-CNS-04/05/08, FR-EVT-05, NFR-UX |
| Event creation and response tracking | FR-EVT-01..07, FR-NOTIF, NFR-REL |
| Assessment to recommendation flow | FR-ASMT, NFR-REL, NFR-PERF |
| AI counselor and AI event drafting | FR-AI, NFR-PERF, NFR-SEC |

## 8. Acceptance Summary

The system is considered compliant with this requirement analysis when:

1. All core role-based workflows execute end-to-end without bypassing required prerequisites.
2. Security controls (JWT auth, role checks, hashing, rate limiting, CORS) are enforced on protected surfaces.
3. Student and counselor operations persist correct state in D1 and surface meaningful UI/API feedback.
4. AI and notification subsystems operate with both primary and fallback behavior.
