/*
 * Pear TV: Samsung TV remote support for YouTube Music, loaded by TizenBrew.
 *
 * A TV conversion of Pear Desktop (https://github.com/pear-devs/pear-desktop,
 * MIT) with every plugin removed. The player controls follow Pear Desktop's
 * renderer: the #movie_player API plus the player-bar buttons.
 *
 * Written for the Chromium 85-class browser on Tizen 6.5: no build step and
 * no syntax newer than ES2017.
 */
(function () {
  'use strict';

  if (window.__pearTv) return;

  // Samsung remote key codes. Arrows, Enter and Back are always delivered;
  // the media and channel keys must be registered first.
  var KEY = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    ENTER: 13,
    BACK: 10009,
    PLAY_PAUSE: 10252,
    PLAY: 415,
    PAUSE: 19,
    STOP: 413,
    FAST_FORWARD: 417,
    REWIND: 412,
    TRACK_NEXT: 10233,
    TRACK_PREVIOUS: 10232,
    CHANNEL_UP: 427,
    CHANNEL_DOWN: 428,
    // Desktop stand-ins so the script can be tried in a normal browser.
    ESCAPE: 27,
  };

  var REGISTER_KEYS = [
    'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
    'MediaFastForward', 'MediaRewind', 'MediaTrackNext',
    'MediaTrackPrevious', 'ChannelUp', 'ChannelDown',
  ];

  var SEEK_SECONDS = 10;

  // Things the remote can land on. Nested matches are collapsed to the
  // outermost one so a single control is a single stop.
  var FOCUSABLE = [
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[role="tab"]',
    '[role="option"]',
    '[role="menuitem"]',
    '[role="checkbox"]',
    '[role="slider"]',
    'tp-yt-paper-item',
    'tp-yt-paper-icon-button',
    'yt-icon-button',
    'ytmusic-play-button-renderer',
  ].join(',');

  var FOCUS_CLASS = 'pear-tv-focus';
  var lastFocused = null;

  function registerRemoteKeys() {
    var input = window.tizen && window.tizen.tvinputdevice;
    if (!input) return;
    REGISTER_KEYS.forEach(function (name) {
      try {
        input.registerKey(name);
      } catch (err) {
        // Already registered by TizenBrew or unsupported on this model.
      }
    });
  }

  function injectStyles() {
    var css = [
      // The focus ring is its own fixed-position layer, because YouTube
      // Music wraps tiles in overflow:hidden boxes that clip outlines.
      '#pear-tv-ring {',
      '  position: fixed;',
      '  pointer-events: none;',
      '  z-index: 2147483647;',
      '  border: 4px solid #ffffff;',
      '  border-radius: 8px;',
      '  box-shadow: 0 0 0 4px rgba(255, 0, 0, 0.7), 0 0 24px rgba(0, 0, 0, 0.8);',
      '  transition: top 0.08s, left 0.08s, width 0.08s, height 0.08s;',
      '  display: none;',
      '}',
      '.' + FOCUS_CLASS + ':focus { outline: none !important; }',
      // The remote has no pointer, so hover-only UI should show on focus too.
      'ytmusic-two-row-item-renderer:focus-within .ytmusic-item-thumbnail-overlay-renderer,',
      'ytmusic-responsive-list-item-renderer:focus-within ytmusic-item-thumbnail-overlay-renderer {',
      '  opacity: 1 !important;',
      '  visibility: visible !important;',
      '}',
      'html { cursor: none; }',
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'pear-tv-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    ring = document.createElement('div');
    ring.id = 'pear-tv-ring';
    document.documentElement.appendChild(ring);
  }

  var ring = null;
  var ringFrame = 0;

  // Keep the ring on the focused element while the page scrolls or animates.
  function updateRing() {
    ringFrame = 0;
    if (!ring) return;
    var el = lastFocused;
    if (!el || !document.contains(el)) {
      ring.style.display = 'none';
      return;
    }
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) {
      ring.style.display = 'none';
      return;
    }
    var pad = 4;
    ring.style.display = 'block';
    ring.style.left = (r.left - pad) + 'px';
    ring.style.top = (r.top - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px';
    ring.style.height = (r.height + pad * 2) + 'px';
  }

  function scheduleRing() {
    if (!ringFrame) ringFrame = window.requestAnimationFrame(updateRing);
  }

  // ---------- Player controls (as in Pear Desktop's renderer) ----------

  function player() {
    return document.querySelector('#movie_player');
  }

  function clickPlayerBar(selector) {
    var button = document.querySelector('ytmusic-player-bar ' + selector);
    if (button) button.click();
    return !!button;
  }

  function togglePlay() {
    var api = player();
    if (api && typeof api.getPlayerState === 'function') {
      if (api.getPlayerState() === 1) api.pauseVideo();
      else api.playVideo();
      return;
    }
    clickPlayerBar('#play-pause-button');
  }

  function play() {
    var api = player();
    if (api && api.playVideo) api.playVideo();
  }

  function pause() {
    var api = player();
    if (api && api.pauseVideo) api.pauseVideo();
  }

  function seekBy(seconds) {
    var api = player();
    if (!api || typeof api.getCurrentTime !== 'function') return;
    var target = Math.max(0, api.getCurrentTime() + seconds);
    api.seekTo(target, true);
  }

  function nextTrack() {
    clickPlayerBar('.next-button');
  }

  function previousTrack() {
    clickPlayerBar('.previous-button');
  }

  // ---------- Spatial navigation ----------

  function isRendered(el) {
    var rects = el.getClientRects();
    if (!rects.length) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    var style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (el.disabled || el.getAttribute('aria-hidden') === 'true') return false;
    if (el.closest('[aria-hidden="true"], [hidden]')) return false;
    return true;
  }

  function inViewport(rect) {
    return (
      rect.bottom > 0 && rect.right > 0 &&
      rect.top < window.innerHeight && rect.left < window.innerWidth
    );
  }

  // Something else is painted on top (for example the expanded player over
  // the home page), so the remote should not stop here.
  function isCovered(el, rect) {
    if (!inViewport(rect)) return false;
    var x = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
    var y = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
    var hit = document.elementFromPoint(x, y);
    if (!hit) return false;
    return !(hit === el || el.contains(hit) || hit.contains(el));
  }

  // Open menus and dialogs trap navigation, as they do with a keyboard.
  function openOverlay() {
    var overlays = document.querySelectorAll(
      'tp-yt-iron-dropdown, tp-yt-paper-dialog, ytmusic-popup-container tp-yt-iron-dropdown'
    );
    for (var i = overlays.length - 1; i >= 0; i--) {
      var o = overlays[i];
      var style = window.getComputedStyle(o);
      if (style.display !== 'none' && o.getAttribute('aria-hidden') !== 'true' && isRendered(o)) {
        return o;
      }
    }
    return null;
  }

  function playerPageOpen() {
    var layout = document.querySelector('ytmusic-app-layout');
    return !!(layout && layout.hasAttribute('player-page-open'));
  }

  function navigationScope() {
    return openOverlay() || document;
  }

  function candidates() {
    var scope = navigationScope();
    var all = scope.querySelectorAll(FOCUSABLE);
    var found = [];
    var byHref = {};

    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!isRendered(el)) continue;

      // Collapse nested matches (for example a <button> inside yt-icon-button).
      var parent = el.parentElement && el.parentElement.closest(FOCUSABLE);
      if (parent && scope.contains(parent) && isRendered(parent)) continue;

      var rect = el.getBoundingClientRect();
      if (isCovered(el, rect)) continue;

      // A tile's thumbnail and title often link to the same place: keep the
      // larger one so each tile is one stop.
      var href = el.tagName === 'A' ? el.getAttribute('href') : null;
      if (href) {
        var prior = byHref[href];
        if (prior) {
          if (rect.width * rect.height > prior.area) {
            found[prior.index] = null;
          } else {
            continue;
          }
        }
        byHref[href] = { index: found.length, area: rect.width * rect.height };
      }

      found.push(el);
    }

    return found.filter(Boolean);
  }

  function center(rect) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  // Score a candidate in one direction: distance along the direction, plus a
  // heavier penalty for drifting sideways. Lower is better.
  function score(from, to, dir) {
    var a = center(from);
    var b = center(to);
    var along;
    var across;
    var overlap;

    if (dir === 'left' || dir === 'right') {
      along = dir === 'right' ? to.left - from.right : from.left - to.right;
      if (dir === 'right' ? b.x <= a.x + 1 : b.x >= a.x - 1) return Infinity;
      overlap = Math.min(from.bottom, to.bottom) - Math.max(from.top, to.top);
      across = Math.abs(b.y - a.y) * (overlap > 0 ? 0.1 : 1);
    } else {
      along = dir === 'down' ? to.top - from.bottom : from.top - to.bottom;
      if (dir === 'down' ? b.y <= a.y + 1 : b.y >= a.y - 1) return Infinity;
      overlap = Math.min(from.right, to.right) - Math.max(from.left, to.left);
      across = Math.abs(b.x - a.x) * (overlap > 0 ? 0.1 : 1);
    }

    return Math.max(along, 0) + across * 3;
  }

  function current() {
    if (lastFocused && document.contains(lastFocused) && isRendered(lastFocused)) {
      var scope = navigationScope();
      if (scope === document || scope.contains(lastFocused)) return lastFocused;
    }
    return null;
  }

  function focus(el) {
    if (!el) return;
    if (lastFocused) lastFocused.classList.remove(FOCUS_CLASS);
    lastFocused = el;
    el.classList.add(FOCUS_CLASS);
    if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
      el.setAttribute('tabindex', '-1');
    }
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    scheduleRing();
    // Carousels scroll smoothly, so follow them for a moment.
    setTimeout(scheduleRing, 150);
    setTimeout(scheduleRing, 400);
  }

  // The first stop when nothing is focused: the item nearest the top-left of
  // the main content, so the first press does something sensible.
  function focusStart() {
    var list = candidates();
    if (!list.length) return;
    var main = document.querySelector('#contents, ytmusic-browse-response, #content');
    var best = null;
    var bestScore = Infinity;
    list.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (!inViewport(rect)) return;
      var inMain = main && main.contains(el) ? 0 : 5000;
      var s = inMain + rect.top * 2 + rect.left;
      if (s < bestScore) {
        bestScore = s;
        best = el;
      }
    });
    focus(best || list[0]);
  }

  function move(dir) {
    var from = current();
    if (!from) {
      focusStart();
      return;
    }
    var fromRect = from.getBoundingClientRect();
    var best = null;
    var bestScore = Infinity;
    candidates().forEach(function (el) {
      if (el === from) return;
      var s = score(fromRect, el.getBoundingClientRect(), dir);
      if (s < bestScore) {
        bestScore = s;
        best = el;
      }
    });
    if (best) {
      focus(best);
    } else if (dir === 'up' || dir === 'down') {
      // Nothing further this way on screen: scroll so more content loads.
      window.scrollBy(0, (dir === 'down' ? 1 : -1) * window.innerHeight * 0.6);
    }
  }

  function activate() {
    var el = current();
    if (!el) {
      focusStart();
      return;
    }
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      // Let the TV's on-screen keyboard open.
      el.focus();
      return;
    }
    el.click();
  }

  // ---------- Back ----------

  function sendEscape() {
    var target = document.activeElement || document.body;
    ['keydown', 'keyup'].forEach(function (type) {
      target.dispatchEvent(new KeyboardEvent(type, {
        key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true,
      }));
    });
  }

  // Returns true when Back was used up inside the app. When it returns false
  // the key is left alone so TizenBrew can take you back out.
  function goBack() {
    if (openOverlay()) {
      sendEscape();
      lastFocused = null;
      return true;
    }
    if (playerPageOpen()) {
      if (!clickPlayerBar('.toggle-player-page-button')) history.back();
      lastFocused = null;
      return true;
    }
    if (location.pathname !== '/' && history.length > 1) {
      history.back();
      lastFocused = null;
      return true;
    }
    return false;
  }

  // ---------- Key handling ----------

  function isTyping() {
    var el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  function onKeyDown(event) {
    var code = event.keyCode;
    var handled = true;

    // While typing in search, arrows and Enter belong to the text field,
    // except Up and Down, which leave it.
    if (isTyping() && (code === KEY.LEFT || code === KEY.RIGHT || code === KEY.ENTER)) {
      return;
    }

    switch (code) {
      case KEY.LEFT: move('left'); break;
      case KEY.RIGHT: move('right'); break;
      case KEY.UP: move('up'); break;
      case KEY.DOWN: move('down'); break;
      case KEY.ENTER: activate(); break;
      case KEY.BACK:
      case KEY.ESCAPE:
        handled = goBack();
        break;
      case KEY.PLAY_PAUSE: togglePlay(); break;
      case KEY.PLAY: play(); break;
      case KEY.PAUSE:
      case KEY.STOP:
        pause();
        break;
      case KEY.FAST_FORWARD: seekBy(SEEK_SECONDS); break;
      case KEY.REWIND: seekBy(-SEEK_SECONDS); break;
      case KEY.TRACK_NEXT:
      case KEY.CHANNEL_UP:
        nextTrack();
        break;
      case KEY.TRACK_PREVIOUS:
      case KEY.CHANNEL_DOWN:
        previousTrack();
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // If something takes focus on its own (a dialog opening, a click with a
  // mouse while testing), follow it so the next press starts from there.
  function onFocusIn(event) {
    var el = event.target;
    if (!(el instanceof Element) || el === lastFocused) return;
    var match = el.closest(FOCUSABLE);
    if (match && isRendered(match)) {
      if (lastFocused) lastFocused.classList.remove(FOCUS_CLASS);
      lastFocused = match;
      match.classList.add(FOCUS_CLASS);
      scheduleRing();
    }
  }

  function start() {
    registerRemoteKeys();
    injectStyles();
    // Capture phase, so YouTube Music's own key shortcuts don't run first.
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    window.addEventListener('scroll', scheduleRing, true);
    window.addEventListener('resize', scheduleRing);
    // Page changes inside the app can remove the focused element.
    setInterval(scheduleRing, 500);
  }

  window.__pearTv = {
    version: '0.1.0',
    move: move,
    activate: activate,
    back: goBack,
    togglePlay: togglePlay,
    candidates: candidates,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
