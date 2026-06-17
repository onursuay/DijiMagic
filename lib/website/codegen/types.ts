/**
 * lib/website/codegen/types.ts
 * Shared types for the Web Site Yöneticisi code-generation engine.
 *
 * YAGNI: only types that are strictly needed today live here.
 * DesignSystem, CodegenContext, GateResult will be added by their respective tasks.
 */

/** Raw HTML string produced by the AI (body content only, no <html>/<head>). */
export type RawBodyHtml = string

/** Sanitized HTML string — safe to persist and render in the publish gate. */
export type SanitizedHtml = string
