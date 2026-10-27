/* ============================================================
   TETRIS — Handheld LCD 1990
   Mesin game murni JavaScript, tanpa dependency.
   Render pakai <canvas> dengan gaya layar LCD monokrom.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Konstanta papan ---------- */
  var COLS = 10;
  var ROWS = 20;
  var CELL = 18;              // ukuran sel logis (px)
  var CLEAR_MS = 180;         // durasi animasi baris hilang

  var INK = '#0f380f';
  var LCD_BG = '#8bac0f';
  var GHOST = 'rgba(15,56,15,0.18)';
  var GRID = 'rgba(15,56,15,0.10)';

  /* ---------- Bentuk tetromino ---------- */
  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
  };
  var TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  /* Skor klasik (dikali level) */
  var LINE_SCORE = { 1: 40, 2: 100, 3: 300, 4: 1200 };

  /* Kecepatan jatuh per level (ms per baris) */
  var SPEEDS = [800, 720, 630, 550, 470, 380, 300, 220, 130, 100,
                85, 85, 75, 75, 75, 60, 60, 60, 45, 45, 35];

  /* ---------- DOM ---------- */
  var $ = function (id) { return document.getElementById(id); };

  var boardCv = $('board');
  var nextCv = $('next');
  var bctx = boardCv.getContext('2d');
  var nctx = nextCv.getContext('2d');

  var overlay = $('overlay');
  var ovTitle = $('ovTitle');
  var ovMsg = $('ovMsg');
  var ovHint = $('ovHint');

  var scoreEl = $('score');
  var hiEl = $('hiscore');
  var levelEl = $('level');
  var linesEl = $('lines');
  var ledPlay = $('ledPlay');

  var btnStart = $('btnStart');
  var btnPause = $('btnPause');
  var btnSound = $('btnSound');
  var btnReset = $('btnReset');

  /* ---------- Canvas tajam di layar HiDPI ---------- */
  function sharpen(canvas, ctx) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.width;
    var h = canvas.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { w: w, h: h };
  }
  sharpen(boardCv, bctx);
  sharpen(nextCv, nctx);

  /* ============================================================
     STATE
     ============================================================ */
  var board = [];
  var piece = null;
  var nextType = null;
  var bag = [];

  var state = 'ready';         // ready | playing | paused | over
  var score = 0;
  var lines = 0;
  var level = 1;
  var hiScore = 0;

  var dropTimer = 0;
  var dropInterval = SPEEDS[0];
  var clearTimer = 0;
  var clearingRows = [];

  var lastTime = 0;
  var rafId = null;

  /* ---------- High score ---------- */
  try {
    hiScore = parseInt(localStorage.getItem('tetris-hi') || '0', 10) || 0;
  } catch (e) { hiScore = 0; }
  hiEl.textContent = String(hiScore);

  /* ============================================================
     AUDIO (WebAudio, gelombang kotak ala 8-bit)
     ============================================================ */
  var actx = null;
  var soundOn = true;

  function ensureAudio() {
    if (!actx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try { actx = new Ctor(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') { actx.resume(); }
    return actx;
  }

  function tone(freq, dur, type, vol, delay) {
    if (!soundOn) return;
    var c = ensureAudio();
    if (!c) return;
    dur = dur || 0.06;
    type = type || 'square';
    vol = vol || 0.045;
    delay = delay || 0;

    var t0 = c.currentTime + delay;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  var sfx = {
    move:   function () { tone(196, 0.035, 'square', 0.03); },
    rotate: function () { tone(330, 0.045, 'square', 0.035); },
    lock:   function () { tone(120, 0.07, 'square', 0.05); },
    drop:   function () { tone(90, 0.09, 'square', 0.055); },
    clear:  function (n) {
      var notes = n >= 4 ? [523, 659, 784, 1047] : [523, 659, 784];
      for (var i = 0; i < notes.length; i++) {
        tone(notes[i], 0.085, 'square', 0.05, i * 0.06);
      }
    },
    level:  function () {
      tone(523, 0.07, 'square', 0.05, 0);
      tone(659, 0.07, 'square', 0.05, 0.08);
      tone(880, 0.10, 'square', 0.05, 0.16);
    },
    over:   function () {
      var notes = [392, 330, 262, 196];
      for (var i = 0; i < notes.length; i++) {
        tone(notes[i], 0.16, 'square', 0.055, i * 0.15);
      }
    },
    start:  function () {
      tone(440, 0.06, 'square', 0.05, 0);
      tone(660, 0.08, 'square', 0.05, 0.07);
      tone(880, 0.10, 'square', 0.05, 0.15);
    }
  };

  /* ============================================================
     UTIL PAPAN
     ============================================================ */
  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) {
      b.push(new Array(COLS).fill(0));
    }
    return b;
  }

  /* 7-bag randomizer: semua tipe keluar sekali per kantong */
  function nextFromBag() {
    if (bag.length === 0) {
      bag = TYPES.slice();
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
    }
    return bag.pop();
  }

  function cloneMatrix(m) {
    return m.map(function (row) { return row.slice(); });
  }

  /* Rotasi matriks searah / berlawanan jarum jam */
  function rotateMatrix(m, dir) {
    var n = m.length;
    var out = [];
    for (var r = 0; r < n; r++) { out.push(new Array(n).fill(0)); }
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (dir > 0) {
          out[x][n - 1 - y] = m[y][x];   // CW
        } else {
          out[n - 1 - x][y] = m[y][x];   // CCW
        }
      }
    }
    return out;
  }

  function collides(m, px, py) {
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var bx = px + c;
        var by = py + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  /* ============================================================
     SPAWN / GERAK
     ============================================================ */
  function spawn() {
    var type = nextType || nextFromBag();
    nextType = nextFromBag();

    var m = cloneMatrix(SHAPES[type]);
    var px = Math.floor((COLS - m[0].length) / 2);

    piece = { type: type, m: m, x: px, y: type === 'I' ? -1 : 0 };

    drawNext();

    if (collides(piece.m, piece.x, piece.y)) {
      endGame();
      return false;
    }
    return true;
  }

  function canMove(dx, dy) {
    return !collides(piece.m, piece.x + dx, piece.y + dy);
  }

  function move(dx) {
    if (state !== 'playing' || clearTimer > 0) return;
    if (canMove(dx, 0)) {
      piece.x += dx;
      sfx.move();
      draw();
    }
  }

  function rotate(dir) {
    if (state !== 'playing' || clearTimer > 0) return;
    var rotated = rotateMatrix(piece.m, dir);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collides(rotated, piece.x + kicks[i], piece.y)) {
        piece.m = rotated;
        piece.x += kicks[i];
        sfx.rotate();
        draw();
        return;
      }
    }
    /* coba geser ke atas sekali (berguna untuk I di dasar) */
    if (!collides(rotated, piece.x, piece.y - 1)) {
      piece.m = rotated;
      piece.y -= 1;
      sfx.rotate();
      draw();
    }
  }

  function stepDown(isSoft) {
    if (canMove(0, 1)) {
      piece.y += 1;
      if (isSoft) addScore(1);
      return true;
    }
    lockPiece();
    return false;
  }

  function softDrop() {
    if (state !== 'playing' || clearTimer > 0) return;
    stepDown(true);
    dropTimer = 0;
    draw();
  }

  function hardDrop() {
    if (state !== 'playing' || clearTimer > 0) return;
    var dist = 0;
    while (canMove(0, 1)) { piece.y += 1; dist++; }
    if (dist > 0) addScore(dist * 2);
    sfx.drop();
    lockPiece();
    draw();
  }

  /* ============================================================
     KUNCI BLOK & BARIS
     ============================================================ */
  function lockPiece() {
    var topOut = false;

    for (var r = 0; r < piece.m.length; r++) {
      for (var c = 0; c < piece.m[r].length; c++) {
        if (!piece.m[r][c]) continue;
        var by = piece.y + r;
        var bx = piece.x + c;
        if (by < 0) { topOut = true; continue; }
        board[by][bx] = 1;
      }
    }

    var full = [];
    for (var y = 0; y < ROWS; y++) {
      var complete = true;
      for (var x = 0; x < COLS; x++) {
        if (!board[y][x]) { complete = false; break; }
      }
      if (complete) full.push(y);
    }

    if (topOut && full.length === 0) {
      sfx.lock();
      endGame();
      return;
    }

    if (full.length > 0) {
      clearingRows = full;
      clearTimer = CLEAR_MS;

      /* skor dihitung dari level saat ini */
      addScore(LINE_SCORE[full.length] * level);
      lines += full.length;

      var newLevel = Math.floor(lines / 10) + 1;
      if (newLevel > level) {
        level = Math.min(newLevel, SPEEDS.length);
        dropInterval = SPEEDS[level - 1];
        sfx.level();
      }
      levelEl.textContent = String(level);
      linesEl.textContent = String(lines);
      sfx.clear(full.length);
    } else {
      sfx.lock();
      spawn();
    }
  }

  function finishClear() {
    clearingRows.sort(function (a, b) { return a - b; });
    for (var i = 0; i < clearingRows.length; i++) {
      board.splice(clearingRows[i], 1);
      board.unshift(new Array(COLS).fill(0));
    }
    clearingRows = [];
    clearTimer = 0;
    spawn();
  }

  function addScore(n) {
    score += n;
    scoreEl.textContent = String(score);
    if (score > hiScore) {
      hiScore = score;
      hiEl.textContent = String(hiScore);
      try { localStorage.setItem('tetris-hi', String(hiScore)); } catch (e) {}
    }
  }

  /* ============================================================
     RENDER
     ============================================================ */
  function paintBlock(ctx, px, py, size, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = INK;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    /* kilau tipis agar terasa seperti segmen LCD */
    ctx.fillStyle = 'rgba(155,188,15,0.14)';
    ctx.fillRect(px + 2, py + 2, size - 4, 1);
    ctx.globalAlpha = 1;
  }

  function draw() {
    var W = COLS * CELL;
    var H = ROWS * CELL;

    bctx.fillStyle = LCD_BG;
    bctx.fillRect(0, 0, W, H);

    /* grid halus */
    bctx.strokeStyle = GRID;
    bctx.lineWidth = 1;
    bctx.beginPath();
    for (var c = 1; c < COLS; c++) {
      bctx.moveTo(c * CELL + 0.5, 0);
      bctx.lineTo(c * CELL + 0.5, H);
    }
    for (var r = 1; r < ROWS; r++) {
      bctx.moveTo(0, r * CELL + 0.5);
      bctx.lineTo(W, r * CELL + 0.5);
    }
    bctx.stroke();

    /* blok yang sudah terkunci */
    var flash = clearTimer > 0 && Math.floor(clearTimer / 45) % 2 === 0;

    for (var y = 0; y < ROWS; y++) {
      var isClearing = clearingRows.indexOf(y) !== -1;
      for (var x = 0; x < COLS; x++) {
        if (!board[y][x]) continue;
        if (isClearing && flash) continue;      // baris berkedip
        paintBlock(bctx, x * CELL, y * CELL, CELL);
      }
    }

    if (piece && state !== 'over') {
      /* bayangan posisi jatuh */
      var gy = piece.y;
      while (!collides(piece.m, piece.x, gy + 1)) gy++;
      if (gy > piece.y) {
        for (var rr = 0; rr < piece.m.length; rr++) {
          for (var cc = 0; cc < piece.m[rr].length; cc++) {
            if (!piece.m[rr][cc]) continue;
            var gby = gy + rr;
            if (gby < 0) continue;
            bctx.fillStyle = GHOST;
            bctx.fillRect((piece.x + cc) * CELL + 3, gby * CELL + 3, CELL - 6, CELL - 6);
          }
        }
      }

      /* blok aktif */
      for (var pr = 0; pr < piece.m.length; pr++) {
        for (var pc = 0; pc < piece.m[pr].length; pc++) {
          if (!piece.m[pr][pc]) continue;
          var py = piece.y + pr;
          if (py < 0) continue;
          paintBlock(bctx, (piece.x + pc) * CELL, py * CELL, CELL);
        }
      }
    }
  }

  function drawNext() {
    var box = 72;
    nctx.clearRect(0, 0, box, box);
    nctx.fillStyle = LCD_BG;
    nctx.fillRect(0, 0, box, box);
    if (!nextType) return;

    var m = SHAPES[nextType];
    var minX = 9, maxX = -1, minY = 9, maxY = -1;
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        if (c < minX) minX = c;
        if (c > maxX) maxX = c;
        if (r < minY) minY = r;
        if (r > maxY) maxY = r;
      }
    }
    var wCells = maxX - minX + 1;
    var hCells = maxY - minY + 1;
    var cs = 14;
    var ox = Math.round((box - wCells * cs) / 2);
    var oy = Math.round((box - hCells * cs) / 2);

    for (var rr = 0; rr < m.length; rr++) {
      for (var cc = 0; cc < m[rr].length; cc++) {
        if (!m[rr][cc]) continue;
        paintBlock(nctx, ox + (cc - minX) * cs, oy + (rr - minY) * cs, cs);
      }
    }
  }

  /* ============================================================
     OVERLAY
     ============================================================ */
  function setOverlay(mode, title, msg, hint) {
    overlay.dataset.state = mode;
    ovTitle.textContent = title;
    ovMsg.textContent = msg;
    ovHint.innerHTML = hint || '';
  }

  function showReady() {
    var coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
                 (navigator.maxTouchPoints || 0) > 0;
    setOverlay('ready', 'TETRIS', 'PRESS START',
      coarse
        ? 'tombol <b>A</b> = jatuh &middot; <b>&uarr;</b> = putar'
        : '&uarr; putar &middot; &larr;&rarr; geser &middot; spasi jatuh');
  }

  /* ============================================================
     ALUR GAME
     ============================================================ */
  function startGame() {
    board = emptyBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = SPEEDS[0];
    dropTimer = 0;
    clearTimer = 0;
    clearingRows = [];
    bag = [];
    nextType = null;

    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    linesEl.textContent = '0';

    state = 'playing';
    ledPlay.classList.add('led--on');
    overlay.dataset.state = 'playing';

    sfx.start();
    spawn();
    draw();
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      ledPlay.classList.remove('led--on');
      setOverlay('paused', 'PAUSE', 'PAUSED',
        'tekan <b>P</b> atau <b>PAUSE</b> untuk lanjut');
    } else if (state === 'paused') {
      state = 'playing';
      ledPlay.classList.add('led--on');
      overlay.dataset.state = 'playing';
    }
  }

  function endGame() {
    state = 'over';
    ledPlay.classList.remove('led--on');
    sfx.over();
    setOverlay('over', 'GAME OVER', 'SCORE ' + score,
      'tekan <b>R</b> untuk main lagi');
    draw();
  }

  function resetToReady() {
    board = emptyBoard();
    piece = null;
    nextType = null;
    bag = [];
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = SPEEDS[0];
    dropTimer = 0;
    clearTimer = 0;
    clearingRows = [];
    state = 'ready';
    ledPlay.classList.remove('led--on');
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    linesEl.textContent = '0';
    drawNext();
    draw();
    showReady();
  }

  /* ============================================================
     LOOP
     ============================================================ */
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    if (!lastTime) lastTime = t;
    var dt = Math.min(t - lastTime, 100);
    lastTime = t;

    if (state !== 'playing') return;

    if (clearTimer > 0) {
      clearTimer -= dt;
      draw();
      if (clearTimer <= 0) finishClear();
      return;
    }

    dropTimer += dt;
    if (dropTimer >= dropInterval) {
      dropTimer -= dropInterval;
      stepDown(false);
      draw();
    }
  }

  /* ============================================================
     INPUT — KEYBOARD
     ============================================================ */
  var heldKeys = {};

  document.addEventListener('keydown', function (e) {
    var k = e.key;

    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Spacebar'].indexOf(k) !== -1) {
      e.preventDefault();
    }

    /* Mulai dari layar siap */
    if (state === 'ready' || state === 'over') {
      if (k === 'Enter' || k === ' ' || k === 'Spacebar' || k === 'r' || k === 'R') {
        startGame();
      }
      return;
    }

    if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); return; }
    if (k === 'r' || k === 'R') { resetToReady(); return; }
    if (state !== 'playing') return;

    if (e.repeat && k !== 'ArrowDown') return;

    switch (k) {
      case 'ArrowLeft':  move(-1); break;
      case 'ArrowRight': move(1); break;
      case 'ArrowDown':  softDrop(); break;
      case 'ArrowUp':
      case 'x':
      case 'X':          rotate(1); break;
      case 'z':
      case 'Z':          rotate(-1); break;
      case ' ':
      case 'Spacebar':   hardDrop(); break;
      default: break;
    }
  });

  /* ============================================================
     INPUT — TOMBOL FISIK DI DEVICE
     ============================================================ */
  var REPEATABLE = { left: 1, right: 1, down: 1 };

  function doAction(action) {
    switch (action) {
      case 'left':      move(-1); break;
      case 'right':     move(1); break;
      case 'down':      softDrop(); break;
      case 'rotate':    rotate(1); break;
      case 'rotateCCW': rotate(-1); break;
      case 'drop':      hardDrop(); break;
      default: break;
    }
  }

  function bindButton(el, action) {
    var repeatTimer = null;
    var delayTimer = null;

    function press(e) {
      e.preventDefault();
      if (state === 'ready' || state === 'over') {
        startGame();
        return;
      }
      if (state !== 'playing') return;
      doAction(action);

      if (REPEATABLE[action]) {
        delayTimer = setTimeout(function () {
          repeatTimer = setInterval(function () { doAction(action); }, 55);
        }, 170);
      }
    }

    function release() {
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

  /* ============================================================
     TOMBOL PILL
     ============================================================ */
  btnStart.addEventListener('click', function () {
    if (state === 'paused') { togglePause(); return; }
    startGame();
  });

  btnPause.addEventListener('click', function () {
    if (state === 'ready' || state === 'over') return;
    togglePause();
  });

  btnReset.addEventListener('click', function () { resetToReady(); });

  btnSound.addEventListener('click', function () {
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
    btnSound.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
    if (soundOn) { sfx.rotate(); }
  });

  /* Klik layar = start / lanjut */
  overlay.addEventListener('click', function () {
    if (state === 'ready' || state === 'over') startGame();
    else if (state === 'paused') togglePause();
  });

  /* Auto-pause kalau tab ditinggalkan */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'playing') togglePause();
  });

  /* ============================================================
     INIT
     ============================================================ */
  board = emptyBoard();
  nextType = nextFromBag();
  drawNext();
  draw();
  showReady();
  rafId = requestAnimationFrame(loop);

  /* ============================================================
     AUTO-FIT: device mengecil kalau viewport pendek
     (game tidak pernah fullscreen, tapi selalu pas di layar)
     ============================================================ */
  var deviceEl = document.getElementById('device');

  function fitDevice() {
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
      /* tarik sisa ruang supaya halaman tidak ikut memanjang */
      deviceEl.style.marginBottom = -(rect.height * (1 - k)) + 'px';
    }
  }

  window.addEventListener('resize', fitDevice);
  window.addEventListener('orientationchange', fitDevice);
  fitDevice();

  /* ============================================================
     HOOK PENGUJIAN — aktif hanya dengan ?debug=1
     Dipakai untuk uji otomatis (lihat tests/README)
     ============================================================ */
  if (/[?&]debug=1/.test(location.search)) {
    window.__tetris = {
      get state() { return state; },
      get board() { return board; },
      get score() { return score; },
      get lines() { return lines; },
      setBoard: function (b) { board = b; draw(); },
      setPiece: function (p) { piece = p; },
      setState: function (s) { state = s; },
      lockPiece: lockPiece,
      finishClear: finishClear,
      hardDrop: hardDrop,
      rotate: rotate,
      move: move,
      start: startGame
    };
  }
})();
