/* ============================================================
   LCD TOOLKIT
   Palet monokrom, primitif gambar, teks pixel, sprite, dan SFX.
   Dipakai bersama oleh semua mini-game supaya tampilannya
   konsisten seperti satu perangkat LCD yang sama.
   ============================================================ */

window.LCD = (function () {
  'use strict';

  var PAL = {
    bg: '#9bbc0f',    // dasar layar
    bg2: '#8bac0f',   // dasar agak gelap (area permainan)
    mid: '#5f8f16',   // nada tengah (bayangan / isi)
    ink: '#0f380f'    // piksel paling gelap
  };

  var FONT = '"Press Start 2P", "Courier New", monospace';

  /* ---------- pola dither 50% (nada antara) ---------- */
  var patterns = new WeakMap();
  var patternsLight = new WeakMap();

  function makePattern(ctx, kind) {
    var store = kind === 'light' ? patternsLight : patterns;
    var p = store.get(ctx);
    if (p) return p;

    var c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    var g = c.getContext('2d');
    g.fillStyle = PAL.mid;
    g.fillRect(0, 0, 4, 4);
    g.fillStyle = PAL.ink;
    if (kind === 'light') {
      g.fillRect(0, 0, 1, 1);            // 25% tinta
    } else {
      g.fillRect(0, 0, 1, 1);            // 50% tinta
      g.fillRect(2, 2, 1, 1);
    }
    p = ctx.createPattern(c, 'repeat');
    store.set(ctx, p);
    return p;
  }

  function ditherPattern(ctx) {
    return makePattern(ctx, 'mid');
  }

  /* ---------- primitif ---------- */

  function clear(ctx, color) {
    ctx.fillStyle = color || PAL.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  /* kotak solid */
  function box(ctx, x, y, w, h, color) {
    ctx.fillStyle = color || PAL.ink;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* kotak nada tengah (dither) */
  function shade(ctx, x, y, w, h) {
    ctx.fillStyle = ditherPattern(ctx);
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* kotak nada terang (dither 25%) — untuk latar jauh */
  function shadeLight(ctx, x, y, w, h) {
    ctx.fillStyle = makePattern(ctx, 'light');
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* garis 1px */
  function line(ctx, x1, y1, x2, y2, color) {
    ctx.fillStyle = color || PAL.ink;
    if (y1 === y2) {
      ctx.fillRect(Math.min(x1, x2), y1, Math.abs(x2 - x1) + 1, 1);
    } else if (x1 === x2) {
      ctx.fillRect(x1, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1);
    } else {
      ctx.beginPath();
      ctx.moveTo(x1 + 0.5, y1 + 0.5);
      ctx.lineTo(x2 + 0.5, y2 + 0.5);
      ctx.strokeStyle = color || PAL.ink;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* bingkai: garis tepi + sudut */
  function frame(ctx, x, y, w, h, color) {
    var c = color || PAL.ink;
    line(ctx, x, y, x + w - 1, y, c);
    line(ctx, x, y + h - 1, x + w - 1, y + h - 1, c);
    line(ctx, x, y, x, y + h - 1, c);
    line(ctx, x + w - 1, y, x + w - 1, y + h - 1, c);
  }

  /* ---------- teks ---------- */

  function text(ctx, str, x, y, size, color, align) {
    size = size || 8;
    ctx.font = size + 'px ' + FONT;
    ctx.textBaseline = 'top';
    ctx.textAlign = align || 'left';
    ctx.fillStyle = color || PAL.ink;
    ctx.fillText(str, Math.round(x), Math.round(y));
    ctx.textAlign = 'left';
  }

  function textWidth(ctx, str, size) {
    ctx.font = (size || 8) + 'px ' + FONT;
    return ctx.measureText(str).width;
  }

  function textCenter(ctx, str, cx, y, size, color) {
    text(ctx, str, cx - textWidth(ctx, str, size) / 2, y, size, color, 'left');
  }

  /* ---------- sprite dari array string ----------
     '#' = tinta, '+' = nada tengah, '.' = transparan            */
  function sprite(ctx, rows, x, y, scale) {
    scale = scale || 1;
    x = Math.round(x);
    y = Math.round(y);
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === '.') continue;
        ctx.fillStyle = ch === '+' ? PAL.mid : PAL.ink;
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  /* ---------- AUDIO 8-bit ---------- */

  var actx = null;
  var soundOn = true;

  function ensureAudio() {
    if (!actx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try { actx = new Ctor(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!soundOn) return;
    var c = ensureAudio();
    if (!c) return;
    dur = dur || 0.06;
    vol = vol || 0.045;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol) {
    if (!soundOn) return;
    var c = ensureAudio();
    if (!c) return;
    dur = dur || 0.12;
    var frames = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, frames, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    var src = c.createBufferSource();
    var gain = c.createGain();
    gain.gain.value = vol || 0.06;
    src.buffer = buf;
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
  }

  var sfx = {
    blip: function () { tone(196, 0.03, 'square', 0.03); },
    select: function () { tone(523, 0.04, 'square', 0.04); },
    confirm: function () { tone(660, 0.05, 'square', 0.05, 0); tone(990, 0.08, 'square', 0.05, 0.06); },
    back: function () { tone(392, 0.05, 'square', 0.04, 0); tone(262, 0.07, 'square', 0.04, 0.05); },
    shoot: function () { tone(880, 0.05, 'square', 0.035, 0, 220); },
    hit: function () { noise(0.06, 0.05); },
    explode: function () { noise(0.22, 0.075); tone(120, 0.18, 'sawtooth', 0.04, 0, 60); },
    jump: function () { tone(330, 0.08, 'square', 0.04, 0, 620); },
    flap: function () { tone(520, 0.05, 'square', 0.04, 0, 700); },
    point: function () { tone(880, 0.05, 'square', 0.045, 0); tone(1174, 0.07, 'square', 0.04, 0.05); },
    die: function () {
      var n = [440, 349, 262, 196];
      for (var i = 0; i < n.length; i++) tone(n[i], 0.14, 'square', 0.05, i * 0.12);
    },
    start: function () { tone(440, 0.06, 'square', 0.05, 0); tone(660, 0.07, 'square', 0.05, 0.07); tone(880, 0.1, 'square', 0.05, 0.14); },
    level: function () { tone(523, 0.07, 'square', 0.05, 0); tone(659, 0.07, 'square', 0.05, 0.08); tone(880, 0.1, 'square', 0.05, 0.16); },
    clear: function () { tone(523, 0.08, 'square', 0.05, 0); tone(659, 0.08, 'square', 0.05, 0.07); tone(784, 0.1, 'square', 0.05, 0.14); }
  };

  return {
    PAL: PAL,
    clear: clear,
    box: box,
    shade: shade,
    shadeLight: shadeLight,
    line: line,
    frame: frame,
    text: text,
    textWidth: textWidth,
    textCenter: textCenter,
    sprite: sprite,
    tone: tone,
    noise: noise,
    sfx: sfx,
    isSoundOn: function () { return soundOn; },
    setSound: function (v) { soundOn = !!v; }
  };
})();
