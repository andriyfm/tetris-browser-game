/* ============================================================
   MENU — GAME SELECT
   Layar pemilihan cartridge: daftar game dengan ikon, skor
   tertinggi, dan sorotan terbalik khas LCD.
   ============================================================ */

window.MINIGAME = window.MINIGAME || {};

(function () {
  'use strict';

  var ITEMS = [
    { id: 'tetris',   name: 'TETRIS',      sub: 'BLOCK GAME',  year: '1990' },
    { id: 'metalslug', name: 'METAL SLUG', sub: 'RUN N GUN',   year: '1996' },
    { id: 'flappy',   name: 'FLAPPY',      sub: 'ONE BUTTON',  year: '2013' }
  ];

  /* ---------- ikon mini, digambar dengan kotak ---------- */
  function icon(ctx, id, x, y, col) {
    var L = window.LCD;
    function px(cx, cy, w, h) { L.box(ctx, x + cx, y + cy, w, h, col); }

    if (id === 'tetris') {
      /* susunan blok L + satu blok jatuh */
      px(2, 14, 7, 7); px(9, 14, 7, 7); px(16, 14, 7, 7);
      px(16, 7, 7, 7);
      px(2, 21, 7, 7);
      px(16, 21, 7, 7);
      px(23, 14, 7, 7);
    } else if (id === 'metalslug') {
      /* prajurit berhelm + senapan */
      px(9, 6, 12, 5);      // helm
      px(11, 11, 8, 5);     // kepala
      px(8, 16, 14, 9);     // badan
      px(22, 18, 9, 3);     // senapan
      px(8, 25, 5, 7);      // kaki kiri
      px(17, 25, 5, 7);     // kaki kanan
    } else {
      /* burung + pipa */
      px(4, 12, 12, 9);     // badan burung
      px(16, 14, 5, 5);     // kepala
      px(2, 15, 3, 3);      // paruh
      px(7, 10, 6, 3);      // sayap
      px(24, 6, 6, 26);     // pipa
      px(22, 6, 10, 4);     // kepala pipa
    }
  }

  MINIGAME.menu = {
    id: 'menu',
    isMenu: true,
    title: 'GAME SELECT',
    w: 180,
    h: 360,
    boardMax: 244,
    usePanel: false,

    create: function (api) {
      var sel = 0;
      var blink = 0;
      var self = {
        state: 'playing',
        score: 0
      };

      function move(d) {
        sel = (sel + d + ITEMS.length) % ITEMS.length;
        api.sfx.blip();
      }

      self.reset = function () { /* menu tidak punya ronde */ };

      self.update = function (dt) {
        blink = (blink + dt) % 1000;
      };

      self.input = function (action) {
        if (action === 'up') { move(-1); return true; }
        if (action === 'down') { move(1); return true; }
        if (action === 'a' || action === 'start') {
          api.sfx.confirm();
          api.launch(ITEMS[sel].id);
          return true;
        }
        return false;
      };

      self.render = function (ctx) {
        var L = window.LCD;
        L.clear(ctx, L.PAL.bg);

        /* bingkai layar */
        L.frame(ctx, 4, 4, 172, 352);
        L.frame(ctx, 6, 6, 168, 348, L.PAL.mid);

        /* judul */
        L.textCenter(ctx, 'GAME SELECT', 90, 14, 8);
        L.line(ctx, 14, 28, 166, 28, L.PAL.mid);

        /* daftar game */
        var top = 40;
        var rowH = 88;

        for (var i = 0; i < ITEMS.length; i++) {
          var it = ITEMS[i];
          var y = top + i * rowH;
          var active = i === sel;

          if (active) {
            L.box(ctx, 10, y, 160, rowH - 8, L.PAL.ink);
          } else {
            L.frame(ctx, 10, y, 160, rowH - 8, L.PAL.mid);
          }

          var fg = active ? L.PAL.bg : L.PAL.ink;

          icon(ctx, it.id, 20, y + 22, fg);

          L.text(ctx, it.name, 58, y + 18, 8, fg);
          L.text(ctx, it.sub, 58, y + 34, 8, active ? L.PAL.bg : L.PAL.mid);

          var hi = api.hi.get(it.id) || 0;
          L.text(ctx, 'HI ' + hi, 58, y + 52, 8, active ? L.PAL.bg : L.PAL.mid);

          if (active) {
            /* penanda pilihan */
            L.text(ctx, '>', 14, y + 18, 8, L.PAL.bg);
          }
        }

        /* petunjuk bawah */
        var hy = 320;
        L.line(ctx, 14, hy - 8, 166, hy - 8, L.PAL.mid);
        L.textCenter(ctx, 'A:PLAY', 66, hy, 8, L.PAL.ink);
        L.text(ctx, 'UP/DN', 100, hy, 8, L.PAL.mid);

        /* kedip kecil di kanan bawah */
        if (blink < 550) {
          L.box(ctx, 160, 348, 5, 5, L.PAL.ink);
        }
      };

      return self;
    }
  };
})();
