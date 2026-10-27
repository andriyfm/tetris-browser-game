/* ============================================================
   TETRIS — BLOCK GAME (1990)
   Papan 10x20, 7-bag randomizer, wall kick, ghost piece.
   ============================================================ */

window.MINIGAME = window.MINIGAME || {};

(function () {
  'use strict';

  var COLS = 10;
  var ROWS = 20;
  var CELL = 18;
  var CLEAR_MS = 180;

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
  var LINE_SCORE = { 1: 40, 2: 100, 3: 300, 4: 1200 };
  var SPEEDS = [800, 720, 630, 550, 470, 380, 300, 220, 130, 100,
                85, 85, 75, 75, 75, 60, 60, 60, 45, 45, 35];

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(0));
    return b;
  }

  function clone(m) {
    return m.map(function (row) { return row.slice(); });
  }

  function rotateMatrix(m, dir) {
    var n = m.length;
    var out = [];
    for (var r = 0; r < n; r++) out.push(new Array(n).fill(0));
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (dir > 0) out[x][n - 1 - y] = m[y][x];
        else out[n - 1 - x][y] = m[y][x];
      }
    }
    return out;
  }

  MINIGAME.tetris = {
    id: 'tetris',
    title: 'TETRIS',
    w: 180,
    h: 360,
    boardMax: 244,
    usePanel: true,
    useNext: true,
    hint: '&uarr; putar &middot; &larr;&rarr; geser &middot; A jatuh',
    labels: { s1: 'SCORE', v1: 0, s2: 'HI', v2: 0, s3: 'LEVEL', v3: 1, s4: 'LINES', v4: 0, next: true },

    create: function (api) {
      var L = window.LCD;
      var board = emptyBoard();
      var piece = null;
      var nextType = null;
      var bag = [];
      var dropTimer = 0;
      var dropInterval = SPEEDS[0];
      var clearTimer = 0;
      var clearing = [];
      var flashTick = 0;

      var self = {
        state: 'ready',
        score: 0,
        lines: 0,
        level: 1
      };

      /* ---------- util ---------- */
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

      function syncPanel() {
        api.panel({
          s1: 'SCORE', v1: self.score,
          s2: 'HI', v2: api.hi.get('tetris'),
          s3: 'LEVEL', v3: self.level,
          s4: 'LINES', v4: self.lines,
          next: true
        });
      }

      function addScore(n) {
        self.score += n;
        api.hi.set('tetris', self.score);
        syncPanel();
      }

      function drawNext() {
        api.next(function (nc, size) {
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
          var w = maxX - minX + 1;
          var h = maxY - minY + 1;
          var cs = 13;
          var ox = Math.round((size - w * cs) / 2);
          var oy = Math.round((size - h * cs) / 2);
          for (var rr = 0; rr < m.length; rr++) {
            for (var cc = 0; cc < m[rr].length; cc++) {
              if (!m[rr][cc]) continue;
              L.box(nc, ox + (cc - minX) * cs + 1, oy + (rr - minY) * cs + 1, cs - 2, cs - 2, L.PAL.ink);
            }
          }
        });
      }

      /* ---------- spawn & gerak ---------- */
      function spawn() {
        var type = nextType || nextFromBag();
        nextType = nextFromBag();
        var m = clone(SHAPES[type]);
        piece = { type: type, m: m, x: Math.floor((COLS - m[0].length) / 2), y: type === 'I' ? -1 : 0 };
        drawNext();
        if (collides(piece.m, piece.x, piece.y)) {
          gameOver();
          return false;
        }
        return true;
      }

      function move(dx) {
        if (self.state !== 'playing' || clearTimer > 0) return;
        if (!collides(piece.m, piece.x + dx, piece.y)) {
          piece.x += dx;
          api.sfx.blip();
        }
      }

      function rotate(dir) {
        if (self.state !== 'playing' || clearTimer > 0) return;
        var rot = rotateMatrix(piece.m, dir);
        var kicks = [0, -1, 1, -2, 2];
        for (var i = 0; i < kicks.length; i++) {
          if (!collides(rot, piece.x + kicks[i], piece.y)) {
            piece.m = rot;
            piece.x += kicks[i];
            api.sfx.select();
            return;
          }
        }
        if (!collides(rot, piece.x, piece.y - 1)) {
          piece.m = rot;
          piece.y -= 1;
          api.sfx.select();
        }
      }

      function stepDown(soft) {
        if (!collides(piece.m, piece.x, piece.y + 1)) {
          piece.y += 1;
          if (soft) addScore(1);
          return true;
        }
        lockPiece();
        return false;
      }

      function softDrop() {
        if (self.state !== 'playing' || clearTimer > 0) return;
        stepDown(true);
        dropTimer = 0;
      }

      function hardDrop() {
        if (self.state !== 'playing' || clearTimer > 0) return;
        var dist = 0;
        while (!collides(piece.m, piece.x, piece.y + 1)) { piece.y += 1; dist++; }
        if (dist > 0) addScore(dist * 2);
        api.sfx.hit();
        lockPiece();
      }

      /* ---------- kunci blok ---------- */
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
          gameOver();
          return;
        }

        if (full.length > 0) {
          clearing = full;
          clearTimer = CLEAR_MS;
          addScore(LINE_SCORE[full.length] * self.level);
          self.lines += full.length;

          var newLevel = Math.floor(self.lines / 10) + 1;
          if (newLevel > self.level) {
            self.level = Math.min(newLevel, SPEEDS.length);
            dropInterval = SPEEDS[self.level - 1];
            api.sfx.level();
          }
          syncPanel();
          api.sfx.clear();
        } else {
          spawn();
        }
      }

      function finishClear() {
        clearing.sort(function (a, b) { return a - b; });
        for (var i = 0; i < clearing.length; i++) {
          board.splice(clearing[i], 1);
          board.unshift(new Array(COLS).fill(0));
        }
        clearing = [];
        clearTimer = 0;
        spawn();
      }

      function gameOver() {
        self.state = 'over';
        api.hi.set('tetris', self.score);
        api.sfx.die();
      }

      /* ---------- kontrak game ---------- */
      self.reset = function () {
        board = emptyBoard();
        self.score = 0;
        self.lines = 0;
        self.level = 1;
        dropInterval = SPEEDS[0];
        dropTimer = 0;
        clearTimer = 0;
        clearing = [];
        bag = [];
        nextType = null;
        piece = null;
        self.state = 'playing';
        spawn();
        syncPanel();
      };

      self.update = function (dt) {
        if (self.state !== 'playing') return;
        flashTick += dt;

        if (clearTimer > 0) {
          clearTimer -= dt;
          if (clearTimer <= 0) finishClear();
          return;
        }

        dropTimer += dt;
        if (dropTimer >= dropInterval) {
          dropTimer -= dropInterval;
          stepDown(false);
        }
      };

      self.input = function (action) {
        if (self.state !== 'playing') return;
        if (action === 'left') move(-1);
        else if (action === 'right') move(1);
        else if (action === 'down') softDrop();
        else if (action === 'up') rotate(1);
        else if (action === 'a') hardDrop();
        else if (action === 'b') rotate(-1);
      };

      self.render = function (ctx) {
        var W = COLS * CELL;
        var H = ROWS * CELL;

        L.clear(ctx, L.PAL.bg2);

        /* grid */
        ctx.fillStyle = 'rgba(15,56,15,0.10)';
        for (var c = 1; c < COLS; c++) ctx.fillRect(c * CELL, 0, 1, H);
        for (var r = 1; r < ROWS; r++) ctx.fillRect(0, r * CELL, W, 1);

        /* blok terkunci */
        var flash = clearTimer > 0 && Math.floor(flashTick / 45) % 2 === 0;
        for (var y = 0; y < ROWS; y++) {
          var isClearing = clearing.indexOf(y) !== -1;
          for (var x = 0; x < COLS; x++) {
            if (!board[y][x]) continue;
            if (isClearing && flash) continue;
            L.box(ctx, x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2, L.PAL.ink);
            L.box(ctx, x * CELL + 2, y * CELL + 2, CELL - 4, 1, L.PAL.mid);
          }
        }

        if (piece && self.state !== 'over') {
          /* bayangan jatuh */
          var gy = piece.y;
          while (!collides(piece.m, piece.x, gy + 1)) gy++;
          if (gy > piece.y) {
            for (var rr = 0; rr < piece.m.length; rr++) {
              for (var cc = 0; cc < piece.m[rr].length; cc++) {
                if (!piece.m[rr][cc]) continue;
                if (gy + rr < 0) continue;
                L.shade(ctx, (piece.x + cc) * CELL + 3, (gy + rr) * CELL + 3, CELL - 6, CELL - 6);
              }
            }
          }

          /* blok aktif */
          for (var pr = 0; pr < piece.m.length; pr++) {
            for (var pc = 0; pc < piece.m[pr].length; pc++) {
              if (!piece.m[pr][pc]) continue;
              var py = piece.y + pr;
              if (py < 0) continue;
              L.box(ctx, (piece.x + pc) * CELL + 1, py * CELL + 1, CELL - 2, CELL - 2, L.PAL.ink);
            }
          }
        }
      };

      /* layar siap: tampilkan papan kosong + label */
      self.render(api.ctx);

      self.debugState = function () {
        var cells = 0;
        for (var y = 0; y < ROWS; y++) {
          for (var x = 0; x < COLS; x++) if (board[y][x]) cells++;
        }
        return {
          state: self.state, score: self.score, lines: self.lines, level: self.level,
          cells: cells, px: piece ? piece.x : null, py: piece ? piece.y : null
        };
      };

      return self;
    }
  };
})();
