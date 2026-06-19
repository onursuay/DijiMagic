/* yoai-builder-runtime v1 */
/*
 * BEHAVIOR CONTRACT (#builder-8b — VISUAL EDITING select layer)
 * ============================================================
 * This runtime runs INSIDE the builder canvas's assembled-doc iframe. That iframe
 * stays SANDBOXED `allow-scripts` (NO allow-same-origin) — so this script CANNOT
 * reach the parent DOM, cookies or storage. The ONLY channel to the parent is
 * window.parent.postMessage(...) (works cross-origin / through the sandbox). The
 * parent (VisualEditLayer) validates every message's origin + shape before acting.
 *
 * It is injected ONLY in BUILDER mode (assembleDocument mode='builder'). The public
 * site, the `/s/` serve and the new-tab preview NEVER include it — those are
 * read-only and must not expose a select/edit surface.
 *
 * WHAT IT DOES
 *   1. On load, finds every top-level marketing block — an element carrying
 *      data-yoai-id (the blockMap contract). For each block it:
 *        - adds a hover highlight outline (CSS class on a single owned <style>),
 *        - on click → postMessage({type:'yoai:select', blockId, blockKey, field?,
 *          rect, text}) to the parent. rect is the block's bounding box in the
 *          IFRAME's own coordinate space; the parent maps it through the device
 *          scale to position the overlay. `field` is set when the click landed on
 *          a [data-yoai-field] sub-element (future-proofing — the current library
 *          marks blocks, not fields, so field is usually undefined).
 *   2. Listens for PARENT commands (postMessage):
 *        - {type:'yoai:highlight', blockId}  → mark that block selected (persistent box)
 *        - {type:'yoai:clear'}               → clear selection highlight
 *      Parent commands are accepted only from the SAME PARENT WINDOW (e.source check).
 *
 * SAFETY / ISOLATION
 *   - Cross-origin safe: postMessage only; no parent-DOM access (sandbox holds).
 *   - CSP 'self': this is an external same-origin file (no inline, no eval).
 *   - Fail-open: every handler is try/caught; an error never blocks the page.
 *   - No leaked globals (IIFE); reduced-motion safe (no animation here anyway).
 *   - The target origin for outbound postMessage is the PARENT's origin, read once
 *     from document.referrer (the dashboard that framed us). Falls back to '*' only
 *     if the referrer is unreadable — the payload carries NO secrets (ids + a text
 *     snippet), so '*' is acceptable; the parent still validates shape + source.
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || window.parent === window) {
    // Not framed → nothing to select against. No-op (defensive).
    return;
  }

  /* ── Resolve the parent's origin for targeted postMessage ─────────────────── */
  var PARENT_ORIGIN = '*';
  try {
    if (document.referrer) {
      PARENT_ORIGIN = new URL(document.referrer).origin || '*';
    }
  } catch (e) { PARENT_ORIGIN = '*'; }

  function postToParent(msg) {
    try { window.parent.postMessage(msg, PARENT_ORIGIN); } catch (e) { /* fail-open */ }
  }

  /* ── Owned highlight styles (single <style>, no inline element styling) ────── */
  function injectStyles() {
    try {
      if (document.getElementById('yoai-builder-style')) return;
      var st = document.createElement('style');
      st.id = 'yoai-builder-style';
      st.textContent =
        '[data-yoai-id]{cursor:pointer;}' +
        '.yoai-be-hover{outline:2px dashed rgba(5,150,105,.55) !important;outline-offset:-2px !important;}' +
        '.yoai-be-selected{outline:2px solid #059669 !important;outline-offset:-2px !important;' +
        'box-shadow:0 0 0 4px rgba(5,150,105,.12) !important;}';
      (document.head || document.documentElement).appendChild(st);
    } catch (e) { /* fail-open */ }
  }

  /* ── Helpers ──────────────────────────────────────────────────────────────── */

  // The top-most [data-yoai-id] ancestor of a node (the block the click belongs to).
  function blockOf(node) {
    if (!node || !node.closest) return null;
    return node.closest('[data-yoai-id]');
  }

  // A [data-yoai-field] sub-element inside the block, if the click landed on one.
  function fieldOf(node, block) {
    if (!node || !node.closest) return '';
    var f = node.closest('[data-yoai-field]');
    if (!f || !block || !block.contains(f)) return '';
    var v = f.getAttribute('data-yoai-field');
    return typeof v === 'string' ? v.trim() : '';
  }

  // Trimmed, length-capped visible text of a block (for the inspector preview).
  function blockText(el) {
    try {
      var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return t.length > 160 ? t.slice(0, 160) : t;
    } catch (e) { return ''; }
  }

  // The block's bounding box in the iframe's own viewport coordinate space.
  function rectOf(el) {
    try {
      var r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    } catch (e) { return { left: 0, top: 0, width: 0, height: 0 }; }
  }

  // The ordered list of every block's data-yoai-id (document order). Lets the parent
  // compute move-up/down (`after` anchors) + canMove boundaries deterministically.
  function blockOrder() {
    var ids = [];
    try {
      var nodes = document.querySelectorAll('[data-yoai-id]');
      for (var i = 0; i < nodes.length; i++) {
        // Top-most only: skip an id nested inside another block (mirrors blockMap).
        var n = nodes[i];
        var parentBlock = n.parentElement ? n.parentElement.closest('[data-yoai-id]') : null;
        if (parentBlock) continue;
        var id = (n.getAttribute('data-yoai-id') || '').trim();
        if (id && ids.indexOf(id) === -1) ids.push(id);
      }
    } catch (e) { /* fail-open */ }
    return ids;
  }

  /* ── Selection state (this iframe owns its own highlight) ──────────────────── */
  var selectedEl = null;
  var hoverEl = null;

  function clearHover() {
    if (hoverEl) { try { hoverEl.classList.remove('yoai-be-hover'); } catch (e) {} hoverEl = null; }
  }
  function clearSelected() {
    if (selectedEl) { try { selectedEl.classList.remove('yoai-be-selected'); } catch (e) {} selectedEl = null; }
  }

  function selectBlockEl(el) {
    if (!el) return;
    clearSelected();
    selectedEl = el;
    try { el.classList.add('yoai-be-selected'); } catch (e) {}
  }

  /* ── Hover highlight ───────────────────────────────────────────────────────── */
  function onMouseOver(e) {
    try {
      var block = blockOf(e.target);
      if (block === hoverEl) return;
      clearHover();
      if (block && block !== selectedEl) {
        hoverEl = block;
        block.classList.add('yoai-be-hover');
      }
    } catch (err) { /* fail-open */ }
  }
  function onMouseOut(e) {
    try {
      var to = e.relatedTarget;
      if (hoverEl && (!to || !hoverEl.contains(to))) clearHover();
    } catch (err) { /* fail-open */ }
  }

  /* ── Click → select → postMessage to parent ───────────────────────────────── */
  function onClick(e) {
    try {
      var block = blockOf(e.target);
      if (!block) return;
      // Prevent in-iframe navigation / form submit while editing on the canvas.
      e.preventDefault();
      e.stopPropagation();

      var blockId = (block.getAttribute('data-yoai-id') || '').trim();
      if (!blockId) return;
      var blockKey = (block.getAttribute('data-yoai-block') || '').trim();
      var field = fieldOf(e.target, block);

      selectBlockEl(block);
      clearHover();

      postToParent({
        type: 'yoai:select',
        blockId: blockId,
        blockKey: blockKey,
        field: field || undefined,
        rect: rectOf(block),
        text: blockText(block),
        order: blockOrder(),
      });
    } catch (err) { /* fail-open */ }
  }

  /* ── Keep the parent's overlay aligned on scroll/resize (rect refresh) ─────── */
  var rafPending = false;
  function emitSelectedRect() {
    if (!selectedEl) return;
    var blockId = (selectedEl.getAttribute('data-yoai-id') || '').trim();
    if (!blockId) return;
    postToParent({ type: 'yoai:rect', blockId: blockId, rect: rectOf(selectedEl) });
  }
  function onScrollOrResize() {
    if (rafPending) return;
    rafPending = true;
    var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
    raf(function () { rafPending = false; emitSelectedRect(); });
  }

  /* ── Parent commands (validated: must come from our parent window) ─────────── */
  function onMessage(e) {
    try {
      // Only accept commands from the window that framed us (the dashboard parent).
      if (e.source !== window.parent) return;
      var data = e.data;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

      if (data.type === 'yoai:clear') {
        clearSelected();
        return;
      }
      if (data.type === 'yoai:highlight') {
        var id = typeof data.blockId === 'string' ? data.blockId.trim() : '';
        if (!id) { clearSelected(); return; }
        // Attribute-value lookup; id is a simple "bN" but query-escape defensively.
        var el = null;
        try {
          el = document.querySelector('[data-yoai-id="' + id.replace(/["\\]/g, '') + '"]');
        } catch (err) { el = null; }
        if (el) { selectBlockEl(el); emitSelectedRect(); }
        return;
      }
    } catch (err) { /* fail-open */ }
  }

  /* ── Init ──────────────────────────────────────────────────────────────────── */
  function init() {
    try {
      injectStyles();
      document.addEventListener('mouseover', onMouseOver, true);
      document.addEventListener('mouseout', onMouseOut, true);
      document.addEventListener('click', onClick, true);
      window.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);
      window.addEventListener('message', onMessage);
      // Tell the parent the runtime is live (it can then send an initial highlight).
      postToParent({ type: 'yoai:ready' });
    } catch (err) { /* fail-open */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
