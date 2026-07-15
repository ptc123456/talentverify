---
product: TalentVerify
audience: developers, DAO hiring teams, technical recruiters
direction: evidence-first developer verification console
colors:
  background: "#F7F8FA"
  surface: "#FFFFFF"
  ink: "#17202A"
  muted: "#667085"
  border: "#D8DEE7"
  accent: "#1769E0"
  success: "#087443"
  warning: "#8A5A00"
  danger: "#B42318"
typography:
  display: "Geist, ui-sans-serif, system-ui, sans-serif"
  body: "Geist, ui-sans-serif, system-ui, sans-serif"
  mono: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
  body_size: "16px"
  body_line_height: 1.55
radius:
  control: "8px"
  card: "12px"
spacing:
  base: "4px"
  section: "48px"
  page_gutter: "24px"
motion:
  duration_fast: "150ms"
  duration_standard: "220ms"
  reduced_motion: "cross-fade or immediate state change"
---

# Design rationale

TalentVerify should feel like a careful developer tool, not a speculative AI dashboard. Evidence and verdicts must be visually connected. The primary accent is blue for links and actions; verdict meaning must never rely on color alone and must include text/icon labels.

Use plain surfaces, thin borders, modest radius, and generous whitespace. Avoid gradients, glows, decorative dashboards, testimonial cards, and arbitrary pills. Requests should read as a chronological evidence record: submitted, evaluating, finalized, or inconclusive.

Every async operation needs visible status and recovery. Long GitHub URLs and LLM reasoning must wrap safely. Forms need visible labels, helper text, inline validation, keyboard focus, and a clear reduced-motion path.
