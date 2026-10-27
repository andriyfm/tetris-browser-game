/* ============================================================
   FLAPPY BIRD — ONE BUTTON (2013)
   Ketuk untuk mengepak, lewati pipa, jangan menyentuh tanah.
   ============================================================ */

window.MINIGAME = window.MINIGAME || {};

(function () {
  'use strict';

  var W = 180;
  var H = 320;
  var GROUND_H = 36;
  var FLOOR = H - GROUND_H;

  var GRAV = 980;
  var FLAP_V = -272;
  var MAX_FALL = 420;

  var PIPE_W = 34;
  var PIPE_GAP = 92;
  var PIPE_EVERY = 118;      // jarak antar pipa (px)
  var BASE_SPEED = 82;

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  MINIGAME.flappy = {
    id: 'flappy',
    title: 'FLAPPY',
    w: W,
    h: H,
    boardMax: 244,
    usePanel: true,
    hint: 'A / B untuk mengepak',
    labels: { s1: 'SCORE', v1: 0, s2: 'HI', v2: 0 },

    create: function (api) {
      var L = window.LCD;

      var bird, pipes, t, score, passed, speed, nextPipeX, groundScroll, dead, hitFlash;
      var self = { state: 'ready', score: 0 };

      function resetBird() {
        bird = { x: 52, y: H * 0.42, vy: 0, wing: 0, rot: 0 };
      }

      function initScene() {
        resetBird();
        pipes = [];
        t = 0;
        score = 0;
        passed = 0;
        speed = BASE_SPEED;
        nextPipeX = W + 40;
        groundScroll = 0;
        dead = false;
        hitFlash = 0;
        self.score = 0;
      }

      function addPipe(x) {
        var margin = 34;
        var gap = Math.max(72, PIPE_GAP - Math.floor(passed / 8) * 2);
        var top = margin + Math.random() * (FLOOR - gap - margin * 2);
        pipes.push({ x: x, top: top, gap: gap, scored: false });
      }

      function flap() {
        if (self.state !== 'playing') return;
        bird.vy = FLAP_V;
        bird.wing = 1;
        api.sfx.flap();
      }

      function die() {
        if (dead) return;
        dead = true;
        self.state = 'over';
        api.hi.set('flappy', score);
        api.sfx.die();
      }

      /* ============================================================
         KONTRAK
         ============================================================ */
      self.reset = function () {
        initScene();
        self.state = 'playing';
        api.sfx.start();
        bird.vy = FLAP_V * 0.7;
      };

      self.update = function (dt) {
        var s = dt / 1000;
        t += dt;                                   // t dalam ms, untuk fase animasi
        groundScroll = (groundScroll + (self.state === 'playing' ? speed : 20) * s) % 24;

        if (self.state !== 'playing') {
          if (dead) {
            /* jatuh ke tanah setelah mati */
            bird.vy = Math.min(bird.vy + GRAV * s, MAX_FALL);
            bird.y = Math.min(bird.y + bird.vy * s, FLOOR - 6);
            if (hitFlash > 0) hitFlash -= s;
          } else {
            /* melayang pelan di layar siap */
            bird.y = H * 0.42 + Math.sin(t / 320) * 7;
            bird.vy = 0;
            bird.wing = (Math.floor(t / 160) % 3);
          }
          return;
        }

        /* fisika burung */
        bird.vy = Math.min(bird.vy + GRAV * s, MAX_FALL);
        bird.y += bird.vy * s;
        bird.rot = Math.max(-0.5, Math.min(1.2, bird.vy / 420));
        if (bird.wing > 0) {
          bird.wing -= s * 6;
          if (bird.wing < 0) bird.wing = 0;
        }

        /* pipa */
        speed = BASE_SPEED + Math.min(46, passed * 1.6);
        for (var i = pipes.length - 1; i >= 0; i--) {
          var pipe = pipes[i];
          pipe.x -= speed * s;

          if (!pipe.scored && pipe.x + PIPE_W < bird.x) {
            pipe.scored = true;
            score += 1;
            passed += 1;
            self.score = score;
            api.hi.set('flappy', score);
            api.sfx.point();
            api.panel({ s1: 'SCORE', v1: score, s2: 'HI', v2: api.hi.get('flappy') });
          }

          if (pipe.x + PIPE_W < -10) pipes.splice(i, 1);
        }

        /* spawn pipa */
        nextPipeX -= speed * s;
        if (nextPipeX <= 0) {
          addPipe(W + 10);
          nextPipeX = PIPE_EVERY;
        }

        /* tabrakan */
        var hitbox = { x: bird.x - 7, y: bird.y - 5, w: 14, h: 10 };

        if (bird.y + 6 >= FLOOR) {
          bird.y = FLOOR - 6;
          hitFlash = 0.3;
          die();
          return;
        }
        if (bird.y - 6 < 0) {
          bird.y = 6;
          bird.vy = 40;
        }

        for (var j = 0; j < pipes.length; j++) {
          var pp = pipes[j];
          var topRect = { x: pp.x, y: 0, w: PIPE_W, h: pp.top };
          var botRect = { x: pp.x, y: pp.top + pp.gap, w: PIPE_W, h: FLOOR - (pp.top + pp.gap) };
          if (rectsOverlap(hitbox, topRect) || rectsOverlap(hitbox, botRect)) {
            hitFlash = 0.3;
            die();
            return;
          }
        }
      };

      self.input = function (action) {
        if (self.state !== 'playing') return;
        if (action === 'a' || action === 'b' || action === 'up') flap();
      };

      /* ============================================================
         GAMBAR
         ============================================================ */
      function drawClouds(ctx) {
        var off = (t / 40) % 200;
        for (var i = -1; i < 3; i++) {
          var cx = i * 100 - off;
          L.shade(ctx, cx + 16, 40, 26, 5);
          L.shade(ctx, cx + 22, 36, 16, 5);
          L.shade(ctx, cx + 60, 92, 22, 4);
        }
      }

      function drawPipe(ctx, x, top, gap) {
        var bottomY = top + gap;

        /* badan pipa atas */
        L.box(ctx, x, 0, PIPE_W, top - 6, L.PAL.ink);
        L.shade(ctx, x + 5, 0, PIPE_W - 10, Math.max(0, top - 6), L.PAL.ink);
        L.frame(ctx, x, 0, PIPE_W, top, L.PAL.ink);
        L.box(ctx, x - 3, top - 7, PIPE_W + 6, 7, L.PAL.ink);
        L.box(ctx, x - 1, top - 6, 3, 4, L.PAL.bg2);

        /* badan pipa bawah */
        var h = FLOOR - bottomY;
        L.box(ctx, x, bottomY + 7, PIPE_W, h, L.PAL.ink);
        L.shade(ctx, x + 5, bottomY + 7, PIPE_W - 10, Math.max(0, h - 7), L.PAL.ink);
        L.box(ctx, x - 3, bottomY, PIPE_W + 6, 7, L.PAL.ink);
        L.box(ctx, x - 1, bottomY + 1, 3, 4, L.PAL.bg2);
      }

      function drawBird(ctx) {
        var x = Math.round(bird.x);
        var y = Math.round(bird.y);

        /* badan */
        L.box(ctx, x - 6, y - 5, 13, 10, L.PAL.ink);
        L.box(ctx, x - 5, y - 6, 11, 1, L.PAL.ink);
        L.box(ctx, x - 5, y + 5, 11, 1, L.PAL.ink);
        L.box(ctx, x - 6, y - 3, 1, 6, L.PAL.ink);
        L.box(ctx, x + 6, y - 3, 1, 6, L.PAL.ink);

        /* perut terang */
        L.box(ctx, x - 3, y + 1, 6, 3, L.PAL.bg);

        /* mata */
        L.box(ctx, x + 2, y - 3, 3, 3, L.PAL.bg);
        L.box(ctx, x + 3, y - 2, 1, 2, L.PAL.ink);

        /* paruh */
        L.box(ctx, x + 7, y - 1, 4, 2, L.PAL.ink);

        /* sayap */
        var wingY = y - 2 + Math.round(Math.sin(t / 90) * 2);
        if (bird.wing > 0) wingY = y - 5;
        L.box(ctx, x - 5, wingY, 7, 3, L.PAL.mid);
        L.box(ctx, x - 4, wingY + 1, 5, 1, L.PAL.ink);
      }

      function drawGround(ctx) {
        L.box(ctx, 0, FLOOR, W, GROUND_H, L.PAL.bg2);
        L.box(ctx, 0, FLOOR, W, 2, L.PAL.ink);

        for (var x = -24; x < W + 24; x += 24) {
          var gx = x - (groundScroll % 24);
          L.box(ctx, gx, FLOOR + 6, 12, 2, L.PAL.mid);
          L.box(ctx, gx + 6, FLOOR + 14, 12, 2, L.PAL.mid);
          L.box(ctx, gx + 3, FLOOR + 24, 12, 2, L.PAL.mid);
        }
      }

      self.render = function (ctx) {
        L.clear(ctx, L.PAL.bg);
        drawClouds(ctx);

        for (var i = 0; i < pipes.length; i++) {
          drawPipe(ctx, Math.round(pipes[i].x), pipes[i].top, pipes[i].gap);
        }

        drawGround(ctx);
        drawBird(ctx);

        /* skor besar di atas */
        if (self.state === 'playing' && score > 0) {
          L.textCenter(ctx, String(score), W / 2, 14, 16, L.PAL.ink);
        }

        if (hitFlash > 0 && Math.floor(hitFlash * 20) % 2 === 0) {
          L.frame(ctx, 0, 0, W, H, L.PAL.ink);
        }
      };

      initScene();
      self.render(api.ctx);

      self.debugState = function () {
        var next = null;
        for (var i = 0; i < pipes.length; i++) {
          if (pipes[i].x + PIPE_W > bird.x) { next = pipes[i]; break; }
        }
        return {
          state: self.state, score: self.score,
          y: Math.round(bird.y), pipes: pipes.length, speed: Math.round(speed),
          pipeXs: pipes.map(function (p) { return Math.round(p.x); }),
          nextPipeX: Math.round(nextPipeX), vy: Math.round(bird.vy),
          gapCenter: next ? Math.round(next.top + next.gap / 2) : null,
          gapSize: next ? next.gap : null
        };
      };

      return self;
    }
  };
})();
