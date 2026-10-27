/* ============================================================
   MAIN — perakitan perangkat
   Menghubungkan layar LCD, tombol fisik, keyboard, panel skor,
   dan siklus hidup mini-game (menu <-> game).
   ============================================================ */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('board');
  var ctx = canvas.getContext('2d');
  var nextCanvas = $('next');
  var nextCtx = nextCanvas.getContext('2d');
  var boardWrap = $('boardWrap');
  var panel = $('panel');
  var deviceEl = $('device');

  var overlay = $('overlay');
  var ovTitle = $('ovTitle');
  var ovMsg = $('ovMsg');
  var ovHint = $('ovHint');

  var btnSound = $('btnSound');
  var btnPause = $('btnPause');
  var btnStart = $('btnStart');
  var btnReset = $('btnReset');

  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  var active = null;        // instance game yang sedang jalan
  var activeDef = null;     // definisi game
  var paused = false;
  var lastTime = 0;
  var lastState = null;
  var held = {};

  /* ============================================================
     HIGH SCORE (per game)
     ============================================================ */
  var hiCache = {};

  function loadHi() {
    var ids = ['tetris', 'metalslug', 'flappy', 'tamagochi'];
    for (var i = 0; i < ids.length; i++) {
      var v = 0;
      try { v = parseInt(localStorage.getItem('hi-' + ids[i]) || '0', 10) || 0; } catch (e) {}
      hiCache[ids[i]] = v;
    }
    /* migrasi skor dari versi Tetris-only */
    try {
      var old = parseInt(localStorage.getItem('tetris-hi') || '0', 10) || 0;
      if (old > (hiCache.tetris || 0)) {
        hiCache.tetris = old;
        localStorage.setItem('hi-tetris', String(old));
      }
    } catch (e) {}
  }

  var hiApi = {
    get: function (id) { return hiCache[id] || 0; },
    set: function (id, v) {
      if (v > (hiCache[id] || 0)) {
        hiCache[id] = v;
        try { localStorage.setItem('hi-' + id, String(v)); } catch (e) {}
      }
    }
  };

  /* ============================================================
     PANEL SKOR (HTML di samping layar)
     ============================================================ */
  var slotEls = {};

  function initPanel() {
    for (var i = 1; i <= 4; i++) {
      slotEls['s' + i] = $('l' + i);
      slotEls['v' + i] = $('v' + i);
      slotEls['row' + i] = document.querySelector('[data-slot="' + i + '"]');
    }
    slotEls.nextRow = document.querySelector('[data-slot="next"]');
  }

  function setPanel(cfg) {
    for (var i = 1; i <= 4; i++) {
      var row = slotEls['row' + i];
      var label = cfg['s' + i];
      var value = cfg['v' + i];
      if (label === undefined && value === undefined) {
        if (row && !row.hidden) row.hidden = true;
        continue;
      }
      if (row && row.hidden) row.hidden = false;
      if (label !== undefined && slotEls['s' + i].textContent !== String(label)) {
        slotEls['s' + i].textContent = label;
      }
      if (value !== undefined && slotEls['v' + i].textContent !== String(value)) {
        slotEls['v' + i].textContent = value;
      }
    }
    if (slotEls.nextRow) {
      slotEls.nextRow.hidden = !cfg.next;
    }
  }

  /* ============================================================
     LAYAR
     ============================================================ */
  function setupNextCanvas() {
    var size = 72;
    nextCanvas.width = size * DPR;
    nextCanvas.height = size * DPR;
    nextCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    nextCtx.imageSmoothingEnabled = false;
  }

  function setScreen(def) {
    canvas.width = def.w * DPR;
    canvas.height = def.h * DPR;
    canvas.style.aspectRatio = def.w + ' / ' + def.h;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;

    boardWrap.style.maxWidth = (def.boardMax || 244) + 'px';
    panel.hidden = !def.usePanel;

    /* label default panel */
    if (def.usePanel && def.labels) setPanel(def.labels);
    fit();
  }

  /* ============================================================
     OVERLAY
     ============================================================ */
  function showOverlay(mode, title, msg, hint) {
    overlay.dataset.state = mode;
    ovTitle.textContent = title;
    ovMsg.innerHTML = msg;
    ovHint.innerHTML = hint || '';
  }

  function hideOverlay() {
    overlay.dataset.state = 'playing';
  }

  /* ============================================================
     API yang dipakai setiap game
     ============================================================ */
  var api = {
    canvas: canvas,
    ctx: ctx,
    sfx: null,
    panel: setPanel,
    next: function (drawFn) {
      nextCtx.clearRect(0, 0, 72, 72);
      nextCtx.fillStyle = '#8bac0f';
      nextCtx.fillRect(0, 0, 72, 72);
      drawFn(nextCtx, 72);
    },
    hi: hiApi,
    held: function (action) { return !!held[action]; },
    launch: function (id) { launch(id); },
    menu: function () { launch('menu'); },
    fit: fit,
    gameId: function () { return activeDef ? activeDef.id : null; }
  };

  /* ============================================================
     SIKLUS GAME
     ============================================================ */
  function launch(id) {
    var def = window.MINIGAME[id] || window.MINIGAME.menu;
    activeDef = def;
    active = def.create(api);
    paused = false;
    lastState = null;
    held = {};

    setScreen(def);
    setPanel(def.usePanel && def.labels ? def.labels : {});

    if (def.isMenu) {
      hideOverlay();
    } else {
      showOverlay('ready', def.title, 'PRESS A', def.hint || '');
    }
    fit();
  }

  function startRound() {
    if (!active) return;
    paused = false;
    lastState = 'playing';
    active.reset();
    hideOverlay();
    if (window.LCD) window.LCD.sfx.start();
  }

  function togglePause() {
    if (!active || activeDef.isMenu || active.state !== 'playing') return;
    paused = !paused;
    if (window.LCD) window.LCD.sfx.blip();
  }

  /* ============================================================
     INPUT
     ============================================================ */
  function input(action) {
    if (!active) return;

    if (action === 'reset') {
      if (!activeDef.isMenu) {
        if (window.LCD) window.LCD.sfx.back();
        launch('menu');
      }
      return;
    }

    if (paused) {
      if (action === 'pause' || action === 'start' || action === 'a') togglePause();
      return;
    }

    if (activeDef.isMenu) {
      active.input(action);
      return;
    }

    if (active.state === 'ready' || active.state === 'over') {
      if (action === 'a' || action === 'start') startRound();
      return;
    }

    if (action === 'pause') { togglePause(); return; }

    active.input(action);
  }

  /* ---------- tombol fisik ---------- */
  var REPEATABLE = { left: true, right: true, down: true, up: false };

  function bindButton(el, action) {
    var delayTimer = null;
    var repeatTimer = null;

    function press(e) {
      if (e && e.preventDefault) e.preventDefault();
      held[action] = true;
      input(action);
      if (REPEATABLE[action]) {
        delayTimer = setTimeout(function () {
          repeatTimer = setInterval(function () { input(action); }, 55);
        }, 180);
      }
    }

    function release() {
      held[action] = false;
      if (delayTimer) { clearTimeout(delayTimer); delayTimer = null; }
      if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
    }

    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  var actionEls = document.querySelectorAll('[data-action]');
  for (var i = 0; i < actionEls.length; i++) {
    bindButton(actionEls[i], actionEls[i].getAttribute('data-action'));
  }

  /* ---------- keyboard ---------- */
  var KEYMAP = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ' ': 'a',
    Spacebar: 'a',
    x: 'a', X: 'a',
    a: 'a', A: 'a',
    z: 'b', Z: 'b',
    b: 'b', B: 'b',
    Enter: 'start',
    p: 'pause', P: 'pause',
    Escape: 'reset',
    r: 'reset', R: 'reset'
  };

  document.addEventListener('keydown', function (e) {
    var action = KEYMAP[e.key];
    if (!action) return;
    if (['left', 'right', 'up', 'down', 'a', 'start'].indexOf(action) !== -1) {
      e.preventDefault();
    }
    if (e.repeat) return;
    held[action] = true;
    input(action);
  });

  document.addEventListener('keyup', function (e) {
    var action = KEYMAP[e.key];
    if (action) held[action] = false;
  });

  /* ---------- tombol pill ---------- */
  btnStart.addEventListener('click', function () {
    if (!active) return;
    if (activeDef.isMenu) input('a');
    else if (active.state === 'ready' || active.state === 'over') startRound();
    else if (paused) togglePause();
  });

  btnPause.addEventListener('click', function () { togglePause(); });
  btnReset.addEventListener('click', function () { input('reset'); });

  btnSound.addEventListener('click', function () {
    var on = !window.LCD.isSoundOn();
    window.LCD.setSound(on);
    btnSound.textContent = on ? 'SOUND ON' : 'SOUND OFF';
    btnSound.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) window.LCD.sfx.select();
  });

  overlay.addEventListener('click', function () {
    if (!active || activeDef.isMenu) return;
    if (active.state === 'ready' || active.state === 'over') startRound();
    else if (paused) togglePause();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && active && !activeDef.isMenu && active.state === 'playing' && !paused) {
      paused = true;
    }
  });

  /* ============================================================
     AUTO-FIT
     ============================================================ */
  function fit() {
    if (!deviceEl) return;
    deviceEl.style.transform = '';
    deviceEl.style.marginBottom = '';

    var rect = deviceEl.getBoundingClientRect();
    if (!rect.height || !rect.width) return;

    var availH = window.innerHeight - 44;
    var availW = window.innerWidth - 20;
    var k = Math.min(1, availH / rect.height, availW / rect.width);

    if (k < 0.995) {
      k = Math.max(k, 0.4);
      deviceEl.style.transformOrigin = 'top center';
      deviceEl.style.transform = 'scale(' + k + ')';
      deviceEl.style.marginBottom = -(rect.height * (1 - k)) + 'px';
    }
  }

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);

  /* ============================================================
     LOOP
     ============================================================ */
  function syncOverlay() {
    if (!active || activeDef.isMenu) return;

    if (paused) {
      if (lastState !== 'paused') {
        showOverlay('paused', 'PAUSE', 'PAUSED', 'P: LANJUT &middot; RESET: MENU');
        lastState = 'paused';
      }
      return;
    }

    if (active.state === lastState) return;

    if (active.state === 'playing') {
      hideOverlay();
    } else if (active.state === 'over') {
      showOverlay('over', 'GAME OVER', 'SCORE ' + active.score,
        'A: MAIN LAGI &middot; RESET: MENU');
    }
    lastState = active.state;
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (!lastTime) lastTime = t;
    var dt = Math.min(t - lastTime, 100);
    lastTime = t;

    if (!active) return;

    if (!paused) active.update(dt);
    active.render(ctx);
    syncOverlay();
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    api.sfx = window.LCD.sfx;
    initPanel();
    setupNextCanvas();
    loadHi();
    launch('menu');
    requestAnimationFrame(loop);

    /* hook pengujian: ?debug=1 */
    if (/[?&]debug=1/.test(location.search)) {
      window.__game = {
        launch: launch,
        menu: function () { launch('menu'); },
        input: input,
        held: function (a, v) { held[a] = v; },
        get game() { return active; },
        get def() { return activeDef; },
        get paused() { return paused; },
        setPaused: function (v) { paused = !!v; },
        startRound: startRound,
        hi: hiCache,
        fit: fit,
        /* majukan simulasi tanpa menunggu rAF (dipakai smoke test) */
        step: function (dt, n) {
          n = n || 1;
          for (var i = 0; i < n; i++) active.update(dt);
          active.render(ctx);
        }
      };
    }
  }

  if (document.fonts && document.fonts.ready) {
    var started = false;
    var go = function () { if (!started) { started = true; boot(); } };
    document.fonts.ready.then(go);
    setTimeout(go, 800);
  } else {
    boot();
  }
})();
