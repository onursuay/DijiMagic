/* dijimagic-select v1 */
/*
 * EDIT-MODE SELECTION OVERLAY (postMessage only — no same-origin needed)
 * =====================================================================
 * This tiny script is injected into the assembled preview document ONLY when the
 * preview is rendered in EDIT MODE (assembleDocument({ editMode:true }) — set by
 * the owner önizleme page via ?edit=1). It is NEVER present on the published
 * `/s/` serve output, NOR on the normal (non-edit) owner preview. The full-page
 * runtime (dijimagic-site-runtime.js) is unaffected — this is additive and isolated.
 *
 * BEHAVIOR
 *   - HOVER over a TOP-LEVEL block [data-dijimagic-block][data-dijimagic-id] → a subtle
 *     outline (inline style, highest specificity, removed on leave).
 *   - CLICK a block → postMessage to the parent window:
 *       { type:'dijimagic:select', blockId, role, rect, text, hasImage?, image? }
 *     where blockId = dataset.dijimagicId, role = dataset.dijimagicBlock, rect = the block's
 *     bounding box (for the parent panel placement), text = a short trimmed
 *     innerText snippet (for the "Metni düzenle" textarea prefill).
 *     IMAGE REPLACE (additive): when the block contains <img> elements we also send
 *       hasImage:true. If the actual clicked element is (or is inside) an <img>, we
 *       additionally send image:{ index, src } — index = that <img>'s position among
 *       the block's images, so the patch can target the EXACT image deterministically.
 *       (Non-image click in an image-bearing block → only hasImage:true, so the panel
 *       can still offer "replace image", defaulting to the first image.)
 *
 * ISOLATION
 *   - The iframe stays sandbox="allow-scripts allow-forms" (NO allow-same-origin).
 *     This script communicates ONLY via window.parent.postMessage — it never
 *     reaches into the parent, never reads cookies, never fetches.
 *   - Fail-open: every handler is try/guarded; an error never breaks the page.
 *   - No leaked globals: the whole thing is an IIFE; no window.* assignments.
 *
 * CSP: script-src 'self' (preview inlines this in edit mode; serve never includes it).
 */
(function () {
  'use strict';

  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // The owner edit overlay only makes sense inside an iframe (parent panel listens).
  // If somehow loaded top-level, do nothing (no parent to message → no-op, fail-safe).
  var parentWin = null;
  try {
    parentWin = window.parent && window.parent !== window ? window.parent : null;
  } catch (e) {
    parentWin = null;
  }
  if (!parentWin) return;

  var OUTLINE = '2px solid #059669'; // brand emerald — no amber/yellow
  var OUTLINE_OFFSET = '-2px';
  var SNIPPET_LEN = 240;

  // The previously-outlined element (so we can clear it cleanly on hover move).
  var hovered = null;

  /** The nearest top-level block ancestor (or self) of an event target. */
  function blockFrom(node) {
    if (!node || !node.closest) return null;
    try {
      return node.closest('[data-dijimagic-block][data-dijimagic-id]');
    } catch (e) {
      return null;
    }
  }

  function setOutline(el) {
    if (!el || el === hovered) return;
    clearOutline();
    try {
      el.style.outline = OUTLINE;
      el.style.outlineOffset = OUTLINE_OFFSET;
      el.style.cursor = 'pointer';
    } catch (e) { /* ignore */ }
    hovered = el;
  }

  function clearOutline() {
    if (!hovered) return;
    try {
      hovered.style.outline = '';
      hovered.style.outlineOffset = '';
      hovered.style.cursor = '';
    } catch (e) { /* ignore */ }
    hovered = null;
  }

  function shortText(el) {
    var raw = '';
    try {
      raw = (el.innerText || el.textContent || '');
    } catch (e) {
      raw = '';
    }
    var collapsed = String(raw).replace(/\s+/g, ' ').trim();
    if (collapsed.length <= SNIPPET_LEN) return collapsed;
    // Clamp on a word boundary so the prefill reads cleanly.
    return collapsed.slice(0, SNIPPET_LEN).replace(/\s+\S*$/, '').trim();
  }

  function rectOf(el) {
    try {
      var r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
    } catch (e) {
      return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 };
    }
  }

  /**
   * Image metadata for the "Görseli değiştir" action.
   * Returns { hasImage, image? } where:
   *   - hasImage = the block contains at least one <img>
   *   - image    = { index, src } of the CLICKED image (only when the click target
   *                 is or is inside an <img> that belongs to this block). index is
   *                 the position of that <img> among block.querySelectorAll('img').
   * Non-sensitive: src is a URL already visible in the rendered page. Fail-open.
   */
  function imageInfo(block, target) {
    var info = { hasImage: false };
    try {
      var imgs = block.querySelectorAll ? block.querySelectorAll('img') : [];
      if (!imgs || !imgs.length) return info;
      info.hasImage = true;
      // The clicked <img> (the target itself, or the nearest <img> ancestor).
      var clicked = null;
      if (target) {
        if (target.tagName && target.tagName.toLowerCase() === 'img') clicked = target;
        else if (target.closest) {
          try { clicked = target.closest('img'); } catch (e) { clicked = null; }
        }
      }
      if (clicked) {
        for (var i = 0; i < imgs.length; i++) {
          if (imgs[i] === clicked) {
            info.image = { index: i, src: String(clicked.getAttribute('src') || clicked.src || '') };
            break;
          }
        }
      }
    } catch (e) { /* ignore — fail-open */ }
    return info;
  }

  function onOver(e) {
    var block = blockFrom(e.target);
    if (block) setOutline(block); else clearOutline();
  }

  function onOut(e) {
    // Only clear when leaving the block subtree entirely (relatedTarget outside).
    var to = e.relatedTarget;
    if (to && blockFrom(to) === hovered) return;
    clearOutline();
  }

  function onClick(e) {
    var block = blockFrom(e.target);
    if (!block) return;
    // Prevent the click from navigating/submitting inside the preview while editing.
    try { e.preventDefault(); } catch (er) { /* ignore */ }
    try { e.stopPropagation(); } catch (er) { /* ignore */ }

    var blockId = (block.getAttribute('data-dijimagic-id') || '').trim();
    if (!blockId) return;
    var role = (block.getAttribute('data-dijimagic-block') || '').trim();
    var imgInfo = imageInfo(block, e.target);

    try {
      // Target origin '*' is acceptable here: the payload is non-sensitive UI
      // metadata (a block id + a visible-text snippet the user already sees + the
      // visible image URL/index), and the PARENT validates
      // e.source === iframe.contentWindow + the field shapes before trusting it.
      var msg = {
        type: 'dijimagic:select',
        blockId: blockId,
        role: role,
        rect: rectOf(block),
        text: shortText(block),
        hasImage: imgInfo.hasImage === true,
      };
      if (imgInfo.image) msg.image = imgInfo.image;
      parentWin.postMessage(msg, '*');
    } catch (er) { /* ignore — fail-open */ }
  }

  function init() {
    try {
      document.addEventListener('mouseover', onOver, true);
      document.addEventListener('mouseout', onOut, true);
      document.addEventListener('click', onClick, true);
      // Signal selectable state to the document (cursor hint surfaces are inline).
      document.documentElement.classList.add('dijimagic-edit');
    } catch (e) { /* fail-open: no overlay, page still renders */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
