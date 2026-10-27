/* ============================================================
   MENU — GAME SELECT
   Layar pemilihan cartridge: grid satu baris (ikon + nama),
   info game terpilih, dan sorotan terbalik khas LCD.
   ============================================================ */

window.MINIGAME = window.MINIGAME || {};

(function () {
  'use strict';

  var ITEMS = [
    { id: 'tetris',   name: 'TETRIS',      sub: 'BLOCK GAME',  year: '1990', lines: ['TETRIS'] },
    { id: 'metalslug', name: 'METAL SLUG', sub: 'RUN N GUN',   year: '1996', lines: ['METAL', 'SLUG'] },
    { id: 'flappy',   name: 'FLAPPY',      sub: 'ONE BUTTON',  year: '2013', lines: ['FLAPPY'] },
    { id: 'tamagochi', name: 'TAMAGOTCHI', sub: 'VIRTUAL PET', year: '1996', lines: ['TAMA', 'GOTCHI'] }
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
    } else if (id === 'flappy') {
      /* burung + pipa */
      px(4, 12, 12, 9);     // badan burung
      px(16, 14, 5, 5);     // kepala
      px(2, 15, 3, 3);      // paruh
      px(7, 10, 6, 3);      // sayap
      px(24, 6, 6, 26);     // pipa
      px(22, 6, 10, 4);     // kepala pipa
    } else {
      /* telur + makhluk kecil */
      px(4, 10, 22, 22);    // badan telur
      px(9, 16, 4, 4);      // mata kiri
      px(17, 16, 4, 4);     // mata kanan
      px(12, 22, 6, 3);     // mulut
      px(0, 6, 7, 4);       // cangkang pecah kiri
      px(23, 6, 7, 4);      // cangkang pecah kanan
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
        if (action === 'up' || action === 'left') { move(-1); return true; }
        if (action === 'down' || action === 'right') { move(1); return true; }
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
        L.textCenter(ctx, 'PICK A CARTRIDGE', 90, 34, 8, L.PAL.mid);

        /* ---------- grid 1 baris × N kolom ---------- */
        var cols = ITEMS.length;
        var gap = 2;
        var tileW = 40;
        var tileH = 96;
        var totalW = cols * tileW + (cols - 1) * gap;
        var x0 = Math.round((180 - totalW) / 2);
        var tileY = 60;

        for (var i = 0; i < cols; i++) {
          var it = ITEMS[i];
          var x = x0 + i * (tileW + gap);
          var active = i === sel;

          if (active) {
            L.box(ctx, x, tileY, tileW, tileH, L.PAL.ink);
          } else {
            L.frame(ctx, x, tileY, tileW, tileH, L.PAL.mid);
          }

          var fg = active ? L.PAL.bg : L.PAL.ink;
          icon(ctx, it.id, x + 4, tileY + 14, fg);

          var lines = it.lines || [it.name];
          for (var li = 0; li < lines.length; li++) {
            L.textCenter(ctx, lines[li], x + tileW / 2, tileY + 52 + li * 8, 6, fg);
          }
        }

        /* penunjuk pilihan di atas tile aktif */
        var cx = Math.round(x0 + sel * (tileW + gap) + tileW / 2);
        L.box(ctx, cx - 4, tileY - 11, 9, 2, L.PAL.ink);
        L.box(ctx, cx - 3, tileY - 9, 7, 2, L.PAL.ink);
        L.box(ctx, cx - 2, tileY - 7, 5, 2, L.PAL.ink);
        L.box(ctx, cx - 1, tileY - 5, 3, 2, L.PAL.ink);

        /* ---------- info game terpilih ---------- */
        var cur = ITEMS[sel];
        L.line(ctx, 14, 176, 166, 176, L.PAL.mid);
        L.textCenter(ctx, cur.name, 90, 188, 8, L.PAL.ink);
        L.textCenter(ctx, cur.sub, 90, 206, 8, L.PAL.mid);
        L.textCenter(ctx, cur.year + '   HI ' + (api.hi.get(cur.id) || 0), 90, 224, 8, L.PAL.mid);

        /* petunjuk bawah */
        L.line(ctx, 14, 248, 166, 248, L.PAL.mid);
        L.textCenter(ctx, 'L/R SELECT', 90, 260, 8, L.PAL.mid);
        L.textCenter(ctx, 'A:PLAY', 90, 282, 8, L.PAL.ink);

        /* kedip kecil di kanan bawah */
        if (blink < 550) {
          L.box(ctx, 160, 346, 5, 5, L.PAL.ink);
        }
      };

      return self;
    }
  };
})();
