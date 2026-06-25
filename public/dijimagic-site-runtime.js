/* dijimagic-site-runtime v1 */
/*
 * BEHAVIOR CONTRACT
 * =================
 * This runtime sets up all interactivity for DijiMagic-generated marketing sites.
 * Generated HTML uses data-dijimagic-* attributes; no arbitrary <script> is needed.
 *
 * REVEAL  [data-dijimagic-reveal]
 *   The runtime sets { opacity:0, transform:'translateY(24px)' } on each element
 *   at init (inline style). On IntersectionObserver trigger it transitions to
 *   { opacity:1, transform:'translateY(0)' } using a CSS transition set inline.
 *   Optional attributes read from the element:
 *     data-dijimagic-duration   — transition duration in ms (default: 600)
 *     data-dijimagic-delay      — transition delay in ms (default: 0)
 *     data-dijimagic-threshold  — IO threshold 0..1 (default: 0.15)
 *   After first reveal the element is unobserved (one-shot).
 *   If prefers-reduced-motion: reveals appear instantly (no animation).
 *
 * TOGGLE  [data-dijimagic-toggle="targetId"]
 *   Clicking the element toggles class `is-open` on document.getElementById(value).
 *   Also toggles the `hidden` attribute and sets `aria-expanded` on the trigger.
 *
 * MOBILE NAV  [data-dijimagic-nav-toggle="panelId"]  +  panel [data-dijimagic-mobile-nav]
 *   Tailwind-PROOF mobile menu. The hamburger button carries
 *   data-dijimagic-nav-toggle="<panelId>" (+ aria-controls / aria-expanded). The
 *   menu panel carries id="<panelId>" data-dijimagic-mobile-nav and an optional
 *   slide direction data-dijimagic-mobile-anim ∈ "left" | "right" | "top"
 *   (DEFAULT "left" if absent).
 *
 *   The panel may carry the AI's own Tailwind styling classes (background,
 *   padding, even a display utility like flex/block/grid). Because a Tailwind
 *   `.flex{display:flex}` rule OVERRIDES the `[hidden]{display:none}` user-agent
 *   rule, hiding via the `hidden` attribute or a plain class is unreliable —
 *   the panel would stay visible and the toggle would do nothing. So the runtime
 *   NEVER uses the `hidden` attribute for the mobile panel. Instead it owns the
 *   panel's visibility + slide purely through INLINE styles (highest specificity,
 *   they beat any display class):
 *     transition: transform .32s cubic-bezier(.4,0,.2,1), opacity .32s
 *     closed → off-screen transform per data-dijimagic-mobile-anim:
 *        left  → translateX(-100%)   right → translateX(100%)   top → translateY(-100%)
 *        + opacity:0; pointer-events:none; aria-hidden="true"
 *     open  → translateX(0)/translateY(0); opacity:1; pointer-events:auto;
 *        aria-hidden="false"; trigger aria-expanded="true"
 *   On init every panel is set to the CLOSED inline state, so it is reliably
 *   hidden on load regardless of any Tailwind display class. Clicking the
 *   hamburger toggles; clicking a link inside or pressing Escape closes.
 *   prefers-reduced-motion: skip the slide — visibility flips instantly.
 *
 * NAV TOGGLE  [data-dijimagic-nav-toggle] (legacy fallback)
 *   If the referenced target is NOT a [data-dijimagic-mobile-nav] panel, the trigger
 *   falls back to the generic class/hidden toggle (back-compat for old markup).
 *
 * SMOOTH SCROLL  a[data-dijimagic-smooth][href^="#"]
 *   Intercepts click and smooth-scrolls to the target element.
 *   Falls back to instant scroll if prefers-reduced-motion.
 *
 * TEXT ROTATE  [data-dijimagic-text-rotate="Word1|Word2|Word3"]
 *   Cycles through the pipe-separated words inside the element with a smooth
 *   fade/slide (inline opacity + transform), looping forever. The "moving text"
 *   for kinetic "modern" headlines.
 *     data-dijimagic-rotate-interval — ms per word (default 2200, clamped 800..8000)
 *   prefers-reduced-motion: shows the FIRST word statically, no cycling.
 *   Capped to a sane number of words; uses setTimeout (cleared on pagehide).
 *
 * GRADIENT MOTION  [data-dijimagic-gradient-anim]  (valueless)
 *   Slowly animates the element's background-position (and a faint hue drift) via
 *   rAF so a gradient background gently shifts ("changing colors"). The element
 *   must already carry a gradient background (e.g. style=background-image:var(...)).
 *   Runs only while on-screen (IntersectionObserver pauses it offscreen) for perf.
 *   prefers-reduced-motion: no-op (gradient stays static).
 *
 * COUNT UP  [data-dijimagic-count-up="1240"]  (optional data-dijimagic-count-suffix="+")
 *   Animates the number from 0 to the target when the element scrolls into view
 *   (IntersectionObserver, one-shot), preserving any suffix. rAF, eased.
 *   prefers-reduced-motion: sets the final value instantly (no tween).
 *
 * CONTACT FORM  [data-dijimagic-form]  (declarative — NO AI script, NO native POST)
 *   On submit the runtime preventDefaults and handles it itself:
 *     1. HONEYPOT: reads the hidden input [data-dijimagic-honeypot] (or [name="company"]).
 *        If non-empty → it's a bot: silently reveal the success element + drop (no send).
 *     2. VALIDATION: name + email + message are required; email matches a simple regex.
 *        On invalid → reveal [data-dijimagic-form-error] (or focus the offending field) and stop.
 *     3. SUBMIT: collects {name,email,phone,message} by input `name`, disables the submit
 *        button, and POSTs JSON to the action read from [data-dijimagic-form-action].
 *        On 2xx → hide the form, reveal [data-dijimagic-form-success].
 *        On non-2xx / network error → reveal [data-dijimagic-form-error] + re-enable.
 *     4. PREVIEW (no data-dijimagic-form-action) → OPTIMISTIC: just reveal success, no fetch.
 *   The action attribute is set by the SERVING layer (assembleDocument, serve mode) to a
 *   same-origin path (/s/<sub>/lead). connect-src 'self' + form-action 'self' allow it.
 *   Fail-open, no throw, no leaked globals; reduced-motion fine.
 *
 * CSP NOTES
 *   No external requests. No eval. No dynamic script injection. The contact form
 *   POSTs to a SAME-ORIGIN path only (connect-src 'self').
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
    var els = document.querySelectorAll('[data-dijimagic-reveal]');
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
        var duration  = parseIntAttr(el, 'data-dijimagic-duration', 600);
        var delay     = parseIntAttr(el, 'data-dijimagic-delay', 0);
        var threshold = parseFloatAttr(el, 'data-dijimagic-threshold', 0.15);

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
    var targetId = trigger.getAttribute('data-dijimagic-toggle');
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
        ? e.target.closest('[data-dijimagic-toggle]')
        : null;
      if (!trigger) return;
      e.preventDefault();
      handleToggle(trigger);
    });
  }

  /* ── Mobile nav (Tailwind-proof inline-style slide) ───────────────────────
   * The runtime owns the panel's visibility + slide transform via INLINE styles
   * (highest specificity → beats any Tailwind flex/block/grid display class).
   * The `hidden` attribute is intentionally NOT used for the mobile panel.
   */

  // Off-screen (closed) transform per slide direction. Default → left.
  function closedTransformFor(anim) {
    switch (anim) {
      case 'right': return 'translateX(100%)';
      case 'top':   return 'translateY(-100%)';
      case 'left':
      default:      return 'translateX(-100%)';
    }
  }

  // Direction the panel is hidden in (read once, default left). Stored so we
  // never re-read a stale/mutated attribute mid-animation.
  function animFor(panel) {
    var raw = (panel.getAttribute('data-dijimagic-mobile-anim') || '').trim().toLowerCase();
    return (raw === 'right' || raw === 'top') ? raw : 'left';
  }

  // Apply the CLOSED inline state (off-screen + invisible + inert).
  function closeMobilePanel(panel) {
    if (!panel) return;
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
    // Reduced motion: no slide, just flip visibility instantly.
    panel.style.transform = reducedMotion ? '' : closedTransformFor(animFor(panel));
    panel.setAttribute('aria-hidden', 'true');
  }

  // Apply the OPEN inline state (on-screen + visible + interactive).
  function openMobilePanel(panel) {
    if (!panel) return;
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    panel.style.transform = reducedMotion ? '' : 'translate(0, 0)';
    panel.setAttribute('aria-hidden', 'false');
  }

  function isMobilePanelOpen(panel) {
    return panel.getAttribute('aria-hidden') === 'false';
  }

  function setExpanded(panelId, expanded) {
    // Sync every trigger that controls this panel.
    var triggers = document.querySelectorAll('[data-dijimagic-nav-toggle="' + panelId + '"]');
    for (var i = 0; i < triggers.length; i++) {
      triggers[i].setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  }

  function setMobilePanelState(panel, open) {
    if (open) openMobilePanel(panel); else closeMobilePanel(panel);
    if (panel.id) setExpanded(panel.id, open);
  }

  function initMobileNav() {
    var panels = document.querySelectorAll('[data-dijimagic-mobile-nav]');

    // 1) Init: force every mobile panel to the CLOSED inline state. Inline styles
    //    beat any Tailwind display class → reliably hidden on load.
    for (var p = 0; p < panels.length; p++) {
      var panel = panels[p];
      if (!reducedMotion) {
        panel.style.transition =
          'transform .32s cubic-bezier(.4,0,.2,1), opacity .32s';
      }
      closeMobilePanel(panel);
      if (panel.id) setExpanded(panel.id, false);
    }

    // 2) Hamburger click (delegated): toggle the controlled mobile panel.
    //    Falls back to the legacy class/hidden toggle for non-mobile targets.
    document.addEventListener('click', function (e) {
      var trigger = e.target && e.target.closest
        ? e.target.closest('[data-dijimagic-nav-toggle]')
        : null;
      if (!trigger) return;

      var targetId = trigger.getAttribute('data-dijimagic-nav-toggle');
      if (!targetId) return;
      var target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();

      if (target.hasAttribute('data-dijimagic-mobile-nav')) {
        setMobilePanelState(target, !isMobilePanelOpen(target));
        return;
      }

      // Legacy fallback (old markup without data-dijimagic-mobile-nav).
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
    });

    // 3) Clicking a link inside an open panel closes it (nice-to-have).
    document.addEventListener('click', function (e) {
      var link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!link) return;
      var panel = link.closest ? link.closest('[data-dijimagic-mobile-nav]') : null;
      if (panel && isMobilePanelOpen(panel)) setMobilePanelState(panel, false);
    });

    // 4) Escape closes any open panel.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.keyCode !== 27) return;
      var open = document.querySelectorAll('[data-dijimagic-mobile-nav][aria-hidden="false"]');
      for (var i = 0; i < open.length; i++) setMobilePanelState(open[i], false);
    });
  }

  /* ── Smooth scroll ────────────────────────────────────────────────────── */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var anchor = e.target && e.target.closest
        ? e.target.closest('a[data-dijimagic-smooth][href^="#"]')
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

  /* ── Text rotate (kinetic headline words) ──────────────────────────────────
   * [data-dijimagic-text-rotate="A|B|C"] cycles the words with a fade/slide loop.
   * Reduced motion → first word, static. Capped + cleanup-safe (timer cleared on
   * pagehide). The element's own text is replaced by the current word.
   */
  var ROTATE_TIMERS = [];
  function initTextRotate() {
    var els = document.querySelectorAll('[data-dijimagic-text-rotate]');
    if (!els.length) return;
    // Cap how many rotating elements we drive (perf / abuse guard).
    var MAX = 12;
    var count = Math.min(els.length, MAX);

    for (var i = 0; i < count; i++) {
      (function (el) {
        var raw = el.getAttribute('data-dijimagic-text-rotate') || '';
        var words = raw.split('|').map(function (w) { return w.trim(); })
          .filter(function (w) { return w.length; });
        // Cap words per element too.
        if (words.length > 8) words = words.slice(0, 8);
        if (!words.length) return;

        // Reduced motion (or single word): just show the first word, no cycling.
        if (reducedMotion || words.length < 2) {
          el.textContent = words[0];
          return;
        }

        var interval = parseIntAttr(el, 'data-dijimagic-rotate-interval', 2200);
        if (interval < 800) interval = 800;
        if (interval > 8000) interval = 8000;

        // Inline transition for the swap (transform + opacity only).
        el.style.display = 'inline-block';
        el.style.transition = 'opacity .35s ease, transform .35s ease';
        el.style.willChange = 'opacity, transform';
        el.textContent = words[0];

        var idx = 0;
        function step() {
          // Fade/slide out, swap text, fade/slide in.
          el.style.opacity = '0';
          el.style.transform = 'translateY(-8px)';
          var t1 = window.setTimeout(function () {
            idx = (idx + 1) % words.length;
            el.textContent = words[idx];
            el.style.transform = 'translateY(8px)';
            // force reflow-free next frame for the in-transition
            requestAnimationFrame(function () {
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            });
          }, 360);
          ROTATE_TIMERS.push(t1);
          var t2 = window.setTimeout(step, interval);
          ROTATE_TIMERS.push(t2);
        }
        var t0 = window.setTimeout(step, interval);
        ROTATE_TIMERS.push(t0);
      })(els[i]);
    }
  }

  /* ── Gradient motion (slowly shifting gradient bg = "changing colors") ──────
   * [data-dijimagic-gradient-anim] (valueless). Drives background-position over time
   * via rAF; pauses while offscreen. Reduced motion → no-op. The element must
   * already have a gradient background; we only move it.
   */
  function initGradientMotion() {
    if (reducedMotion) return;
    var els = document.querySelectorAll('[data-dijimagic-gradient-anim]');
    if (!els.length || !window.requestAnimationFrame) return;
    var MAX = 8;
    var count = Math.min(els.length, MAX);

    for (var i = 0; i < count; i++) {
      (function (el) {
        // Ensure the gradient is larger than the box so panning is visible.
        el.style.backgroundSize = '200% 200%';
        var visible = true;
        var rafId = 0;
        var start = 0;

        function frame(ts) {
          if (!start) start = ts;
          // ~24s full loop; gentle sinusoidal pan on both axes.
          var t = (ts - start) / 24000;
          var x = 50 + 50 * Math.sin(t * 2 * Math.PI);
          var y = 50 + 50 * Math.cos(t * 2 * Math.PI);
          el.style.backgroundPosition = x.toFixed(2) + '% ' + y.toFixed(2) + '%';
          if (visible) rafId = requestAnimationFrame(frame);
        }

        function play() {
          if (rafId) return;
          start = 0;
          rafId = requestAnimationFrame(frame);
        }
        function pause() {
          if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        }

        if (window.IntersectionObserver) {
          var io = new IntersectionObserver(function (entries) {
            for (var e = 0; e < entries.length; e++) {
              visible = entries[e].isIntersecting;
              if (visible) play(); else pause();
            }
          }, { threshold: 0 });
          io.observe(el);
        } else {
          play();
        }
      })(els[i]);
    }
  }

  /* ── Count up (animate a number 0→target when scrolled into view) ───────────
   * [data-dijimagic-count-up="1240"] (+ optional data-dijimagic-count-suffix="+").
   * One-shot via IntersectionObserver. Reduced motion / no-IO → final value set
   * instantly. Eased with rAF.
   */
  function initCountUp() {
    var els = document.querySelectorAll('[data-dijimagic-count-up]');
    if (!els.length) return;

    function finalText(el) {
      var target = parseFloatAttr(el, 'data-dijimagic-count-up', 0);
      var suffix = el.getAttribute('data-dijimagic-count-suffix') || '';
      return formatNumber(target) + suffix;
    }
    function formatNumber(n) {
      // Integer if the target is whole; else one decimal. Group thousands.
      var isInt = Math.abs(n - Math.round(n)) < 0.0001;
      var v = isInt ? Math.round(n) : Math.round(n * 10) / 10;
      try { return v.toLocaleString(); } catch (e) { return String(v); }
    }

    if (reducedMotion || !window.requestAnimationFrame) {
      for (var j = 0; j < els.length; j++) els[j].textContent = finalText(els[j]);
      return;
    }
    if (!window.IntersectionObserver) {
      for (var k = 0; k < els.length; k++) els[k].textContent = finalText(els[k]);
      return;
    }

    var MAX = 24;
    var observer = new IntersectionObserver(function (entries, obs) {
      for (var e = 0; e < entries.length; e++) {
        var entry = entries[e];
        if (!entry.isIntersecting) continue;
        animateCount(entry.target);
        obs.unobserve(entry.target);
      }
    }, { threshold: 0.4 });

    function animateCount(el) {
      var target = parseFloatAttr(el, 'data-dijimagic-count-up', 0);
      var suffix = el.getAttribute('data-dijimagic-count-suffix') || '';
      var dur = 1400;
      var t0 = 0;
      function tick(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        // easeOutCubic
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = formatNumber(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = formatNumber(target) + suffix;
      }
      requestAnimationFrame(tick);
    }

    var cap = Math.min(els.length, MAX);
    for (var i = 0; i < cap; i++) observer.observe(els[i]);
    // Any beyond the cap just get their final value immediately.
    for (var m = cap; m < els.length; m++) els[m].textContent = finalText(els[m]);
  }

  /* ── Contact form (declarative submit → same-origin lead endpoint) ────────
   * No AI script: the runtime owns submit. Honeypot + simple validation guard
   * spam; the real spam/rate defense is server-side. Fail-open: any unexpected
   * error is caught and surfaced via the error element, never thrown.
   */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function fieldByName(form, name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function valueOf(form, name) {
    var el = fieldByName(form, name);
    return el && typeof el.value === 'string' ? el.value.trim() : '';
  }

  function showHidden(el) {
    if (!el) return;
    el.hidden = false;
    el.removeAttribute('hidden');
  }

  function handleFormSubmit(form) {
    // Honeypot: a real (human-invisible) input. If a bot filled it → silent drop.
    var honey = form.querySelector('[data-dijimagic-honeypot]') || fieldByName(form, 'company');
    var successEl = form.querySelector('[data-dijimagic-form-success]');
    var errorEl = form.querySelector('[data-dijimagic-form-error]');
    var submitBtn = form.querySelector('button[type="submit"], button:not([type])');

    // Hide any stale error before re-trying.
    if (errorEl) { errorEl.hidden = true; errorEl.setAttribute('hidden', ''); }

    if (honey && typeof honey.value === 'string' && honey.value.trim() !== '') {
      // Bot — show success and drop silently (no fetch).
      form.style.display = 'none';
      showHidden(successEl);
      return;
    }

    var name = valueOf(form, 'name');
    var email = valueOf(form, 'email');
    var phone = valueOf(form, 'phone');
    var message = valueOf(form, 'message');

    // Basic validation: name + email + message required; simple email shape.
    var invalidField = null;
    if (!name) invalidField = fieldByName(form, 'name');
    else if (!email || !EMAIL_RE.test(email)) invalidField = fieldByName(form, 'email');
    else if (!message) invalidField = fieldByName(form, 'message');

    if (invalidField) {
      if (errorEl) { showHidden(errorEl); }
      try { invalidField.focus(); } catch (e) { /* ignore */ }
      return;
    }

    var action = form.getAttribute('data-dijimagic-form-action');

    // PREVIEW (no action wired) → optimistic success, no real send.
    if (!action) {
      form.style.display = 'none';
      showHidden(successEl);
      return;
    }

    // Disable submit during the request (re-enabled on failure).
    if (submitBtn) submitBtn.disabled = true;

    var done = false;
    function onFailure() {
      if (done) return;
      done = true;
      if (submitBtn) submitBtn.disabled = false;
      showHidden(errorEl);
    }
    function onSuccess() {
      if (done) return;
      done = true;
      form.style.display = 'none';
      showHidden(successEl);
    }

    try {
      fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, phone: phone, message: message })
      }).then(function (res) {
        if (res && res.ok) onSuccess(); else onFailure();
      }).catch(function () {
        onFailure();
      });
    } catch (e) {
      // Fail-open: if fetch is unavailable/threw synchronously, surface the error.
      onFailure();
    }
  }

  function initContactForm() {
    document.addEventListener('submit', function (e) {
      var form = e.target && e.target.closest
        ? e.target.closest('[data-dijimagic-form]')
        : null;
      if (!form) return;
      e.preventDefault();
      try {
        handleFormSubmit(form);
      } catch (err) {
        // Never let a handler error block the page.
      }
    });
  }

  /* ── Init ─────────────────────────────────────────────────────────────── */
  function init() {
    // Fix 1: signal that JS is running so reveal elements can be safely hidden
    document.documentElement.classList.add('dijimagic-js');
    initReveal();
    initToggle();
    initMobileNav();
    initSmoothScroll();
    initTextRotate();
    initGradientMotion();
    initCountUp();
    initContactForm();
  }

  // Cleanup: clear rotate timers on pagehide (back/forward cache + nav).
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', function () {
      for (var i = 0; i < ROTATE_TIMERS.length; i++) {
        try { window.clearTimeout(ROTATE_TIMERS[i]); } catch (e) { /* ignore */ }
      }
      ROTATE_TIMERS.length = 0;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
