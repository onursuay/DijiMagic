/* yoai-site-runtime v1 */
/*
 * BEHAVIOR CONTRACT
 * =================
 * This runtime sets up all interactivity for YoAi-generated marketing sites.
 * Generated HTML uses data-yoai-* attributes; no arbitrary <script> is needed.
 *
 * REVEAL  [data-yoai-reveal]
 *   The runtime sets { opacity:0, transform:'translateY(24px)' } on each element
 *   at init (inline style). On IntersectionObserver trigger it transitions to
 *   { opacity:1, transform:'translateY(0)' } using a CSS transition set inline.
 *   Optional attributes read from the element:
 *     data-yoai-duration   — transition duration in ms (default: 600)
 *     data-yoai-delay      — transition delay in ms (default: 0)
 *     data-yoai-threshold  — IO threshold 0..1 (default: 0.15)
 *   After first reveal the element is unobserved (one-shot).
 *   If prefers-reduced-motion: reveals appear instantly (no animation).
 *
 * TOGGLE  [data-yoai-toggle="targetId"]
 *   Clicking the element toggles class `is-open` on document.getElementById(value).
 *   Also toggles the `hidden` attribute and sets `aria-expanded` on the trigger.
 *
 * NAV TOGGLE  [data-yoai-nav-toggle="targetId"]
 *   Same as toggle but scoped to mobile nav intent.
 *   Sets `aria-expanded` on the trigger element.
 *
 * SMOOTH SCROLL  a[data-yoai-smooth][href^="#"]
 *   Intercepts click and smooth-scrolls to the target element.
 *   Falls back to instant scroll if prefers-reduced-motion.
 *
 * CSP NOTES
 *   No external requests. No eval. No dynamic script injection.
 *   Safe for script-src 'self'; connect-src 'self'.
 */

(function () {
  'use strict';

  /* ── Reduced-motion guard ─────────────────────────────────────────────── */
  var reducedMotion = (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function parseIntAttr(el, attr, fallback) {
    var raw = el.getAttribute(attr);
    if (raw === null) return fallback;
    var n = parseInt(raw, 10);
    return isNaN(n) ? fallback : n;
  }

  function parseFloatAttr(el, attr, fallback) {
    var raw = el.getAttribute(attr);
    if (raw === null) return fallback;
    var n = parseFloat(raw);
    return isNaN(n) ? fallback : n;
  }

  /* ── Per-element params store (Fix 2: WeakMap instead of expando props) ── */
  var elParams = new WeakMap();

  /* ── Reveal ───────────────────────────────────────────────────────────── */
  function revealEl(target, observer) {
    var params = elParams.get(target) || { duration: 600, delay: 0 };
    target.style.transition =
      'opacity ' + params.duration + 'ms ease ' + params.delay + 'ms, ' +
      'transform ' + params.duration + 'ms ease ' + params.delay + 'ms';
    target.style.opacity = '1';
    target.style.transform = 'translateY(0)';
    target.style.willChange = 'auto';
    if (observer) observer.unobserve(target);
  }

  function revealAll(els) {
    for (var i = 0; i < els.length; i++) {
      els[i].style.opacity = '1';
      els[i].style.transform = 'none';
    }
  }

  function initReveal() {
    var els = document.querySelectorAll('[data-yoai-reveal]');
    if (!els.length) return;

    if (reducedMotion) {
      // Instant reveal — no animation
      revealAll(els);
      return;
    }

    if (!window.IntersectionObserver) {
      // Fallback for very old browsers: reveal immediately
      revealAll(els);
      return;
    }

    // Fix 1: gate hidden state on JS running; wrap in try/catch for fail-open
    var hiddenEls = [];
    try {
      // Group elements by threshold so we can create one IO per threshold value
      var byThreshold = {};
      for (var k = 0; k < els.length; k++) {
        var el = els[k];
        var duration  = parseIntAttr(el, 'data-yoai-duration', 600);
        var delay     = parseIntAttr(el, 'data-yoai-delay', 0);
        var threshold = parseFloatAttr(el, 'data-yoai-threshold', 0.15);

        // Clamp threshold to valid 0..1 range
        if (threshold < 0) threshold = 0;
        if (threshold > 1) threshold = 1;

        // Set hidden initial state inline (no external CSS dependency)
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
        el.style.willChange = 'opacity, transform';
        hiddenEls.push(el);

        // Fix 2: store params in WeakMap, not as expando properties on the DOM node
        elParams.set(el, { duration: duration, delay: delay });

        var key = String(threshold);
        if (!byThreshold[key]) {
          byThreshold[key] = { threshold: threshold, elements: [] };
        }
        byThreshold[key].elements.push(el);
      }

      // Create one IntersectionObserver per unique threshold
      var thresholdKeys = Object.keys(byThreshold);
      for (var t = 0; t < thresholdKeys.length; t++) {
        (function (group) {
          var observer = new IntersectionObserver(function (entries) {
            for (var e = 0; e < entries.length; e++) {
              var entry = entries[e];
              if (!entry.isIntersecting) continue;
              revealEl(entry.target, observer);
            }
          }, { threshold: group.threshold });

          for (var i = 0; i < group.elements.length; i++) {
            observer.observe(group.elements[i]);
          }
        })(byThreshold[thresholdKeys[t]]);
      }
    } catch (err) {
      // Fix 1 fail-open: if observer setup threw, reveal everything we hid
      revealAll(hiddenEls);
    }
  }

  /* ── Toggle ───────────────────────────────────────────────────────────── */
  function handleToggle(trigger) {
    var targetId = trigger.getAttribute('data-yoai-toggle');
    if (!targetId) return;
    var target = document.getElementById(targetId);
    if (!target) return;

    var isOpen = target.classList.contains('is-open');
    if (isOpen) {
      target.classList.remove('is-open');
      target.setAttribute('hidden', '');
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      target.classList.add('is-open');
      target.removeAttribute('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
  }

  function initToggle() {
    document.addEventListener('click', function (e) {
      var trigger = e.target && e.target.closest
        ? e.target.closest('[data-yoai-toggle]')
        : null;
      if (!trigger) return;
      e.preventDefault();
      handleToggle(trigger);
    });
  }

  /* ── Nav toggle ───────────────────────────────────────────────────────── */
  function handleNavToggle(trigger) {
    var targetId = trigger.getAttribute('data-yoai-nav-toggle');
    if (!targetId) return;
    var target = document.getElementById(targetId);
    if (!target) return;

    var isOpen = target.classList.contains('is-open');
    if (isOpen) {
      target.classList.remove('is-open');
      target.setAttribute('hidden', '');
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      target.classList.add('is-open');
      target.removeAttribute('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
  }

  function initNavToggle() {
    document.addEventListener('click', function (e) {
      var trigger = e.target && e.target.closest
        ? e.target.closest('[data-yoai-nav-toggle]')
        : null;
      if (!trigger) return;
      e.preventDefault();
      handleNavToggle(trigger);
    });
  }

  /* ── Smooth scroll ────────────────────────────────────────────────────── */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var anchor = e.target && e.target.closest
        ? e.target.closest('a[data-yoai-smooth][href^="#"]')
        : null;
      if (!anchor) return;

      var href = anchor.getAttribute('href');
      if (!href || href === '#') return;

      var targetId = href.slice(1);
      var target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();

      if (reducedMotion) {
        target.scrollIntoView();
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ── Init ─────────────────────────────────────────────────────────────── */
  function init() {
    // Fix 1: signal that JS is running so reveal elements can be safely hidden
    document.documentElement.classList.add('yoai-js');
    initReveal();
    initToggle();
    initNavToggle();
    initSmoothScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
