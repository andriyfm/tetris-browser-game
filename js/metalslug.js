/* ============================================================
   METAL SLUG — RUN & GUN (1996)
   Side-scroller monokrom: lari, lompat, tembak, hancurkan
   gelombang musuh, lalu lanjut ke misi berikutnya.
   ============================================================ */

window.MINIGAME = window.MINIGAME || {};

(function () {
  'use strict';

  var W = 320;
  var H = 180;
  var GROUND = 148;

  var GRAV = 820;
  var JUMP_V = -292;
  var RUN_SPEED = 96;

  var PLAYER_W = 14;
  var PLAYER_H = 22;

  var MISSION_LEN = 1500;

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  MINIGAME.metalslug = {
    id: 'metalslug',
    title: 'METAL SLUG',
    w: W,
    h: H,
    boardMax: 344,
    usePanel: false,
    hint: 'A lompat &middot; B tembak &middot; &uarr; bidik atas',

    create: function (api) {
      var L = window.LCD;

      var p, bullets, ebullets, enemies, parts, cam, mission, spawnTimer, banner, shake;

      var self = { state: 'ready', score: 0 };

      /* ============================================================
         SETUP
         ============================================================ */
      function makePlayer() {
        return {
          x: 60, y: GROUND, vy: 0, onGround: true,
          face: 1, hp: 3, inv: 0, shootCd: 0, run: 0, aimUp: false, alive: true
        };
      }

      function spawnEnemy(kind, x) {
        if (kind === 'charger') {
          return { kind: 'charger', x: x, y: GROUND, w: 12, h: 18, hp: 2, vx: -70 - mission * 4, cd: 0, anim: 0, hurt: 0 };
        }
        return { kind: 'grunt', x: x, y: GROUND, w: 13, h: 22, hp: 2, vx: -26, cd: 1.2 + Math.random(), anim: 0, hurt: 0 };
      }

      function initScene() {
        p = makePlayer();
        bullets = [];
        ebullets = [];
        enemies = [];
        parts = [];
        cam = 0;
        mission = 1;
        spawnTimer = 0.9;
        banner = 0;
        shake = 0;
        self.score = 0;

        /* beberapa musuh awal supaya layar tidak kosong */
        for (var i = 0; i < 3; i++) {
          enemies.push(spawnEnemy(i === 2 ? 'charger' : 'grunt', 200 + i * 90));
        }
      }

      function addPart(x, y, kind) {
        parts.push({ x: x, y: y, t: 0, life: kind === 'boom' ? 0.45 : 0.25, kind: kind });
      }

      function boom(x, y) {
        addPart(x, y, 'boom');
        api.sfx.explode();
        shake = 3;
      }

      /* ============================================================
         AKSI
         ============================================================ */
      function shoot() {
        if (p.shootCd > 0) return;
        p.shootCd = 0.16;
        var gx = p.face > 0 ? p.x + 11 : p.x - 3;
        var gy = p.aimUp ? p.y - 20 : p.y - 10;
        bullets.push({
          x: gx, y: gy,
          vx: p.face * 300,
          vy: p.aimUp ? -170 : 0,
          w: 4, h: 2, life: 1.6
        });
        api.sfx.shoot();
      }

      function jump() {
        if (!p.onGround) return;
        p.vy = JUMP_V;
        p.onGround = false;
        api.sfx.jump();
      }

      function hurt() {
        if (p.inv > 0 || !p.alive) return;
        p.hp -= 1;
        p.inv = 1.4;
        p.vy = -120;
        shake = 4;
        api.sfx.hit();
        if (p.hp <= 0) {
          p.alive = false;
          self.state = 'over';
          api.hi.set('metalslug', self.score);
          api.sfx.die();
          boom(p.x + 6, p.y - 8);
        }
      }

      /* ============================================================
         UPDATE
         ============================================================ */
      function updatePlayer(dt) {
        var s = dt / 1000;
        if (!p.alive) return;

        var move = 0;
        if (api.held('left')) move -= 1;
        if (api.held('right')) move += 1;

        if (move !== 0) {
          p.face = move;
          p.x += move * RUN_SPEED * s;
          p.run += s * 9;
        } else {
          p.run = 0;
        }
        p.x = Math.max(10, Math.min(p.x, MISSION_LEN - 10));

        /* fisika vertikal */
        p.vy += GRAV * s;
        p.y += p.vy * s;
        if (p.y >= GROUND) {
          p.y = GROUND;
          p.vy = 0;
          p.onGround = true;
        } else {
          p.onGround = false;
        }

        p.aimUp = !!api.held('up');
        if (api.held('b')) shoot();
        if (p.shootCd > 0) p.shootCd -= s;
        if (p.inv > 0) p.inv -= s;

        /* tembus ujung misi */
        if (p.x > MISSION_LEN - 30) {
          mission += 1;
          self.score += 500;
          api.hi.set('metalslug', self.score);
          api.sfx.level();
          banner = 1.8;
          p.x = 40;
          enemies = [];
          ebullets = [];
          spawnTimer = 0.7;
          for (var i = 0; i < 2 + mission; i++) {
            enemies.push(spawnEnemy(Math.random() < 0.35 ? 'charger' : 'grunt', 220 + i * 80));
          }
        }
      }

      function updateEnemies(dt) {
        var s = dt / 1000;
        for (var i = enemies.length - 1; i >= 0; i--) {
          var e = enemies[i];
          e.anim += dt;
          if (e.hurt > 0) e.hurt -= s;

          /* bergerak ke arah pemain */
          var dx = p.x - e.x;
          if (e.kind === 'charger') {
            e.x += (dx > 0 ? 1 : -1) * Math.abs(e.vx) * s;
            if (Math.abs(dx) < 20 && Math.abs(p.y - e.y) < 20) hurt();
          } else {
            if (Math.abs(dx) > 60) {
              e.x += (dx > 0 ? 1 : -1) * Math.abs(e.vx) * s;
            }
            e.cd -= s;
            if (e.cd <= 0 && Math.abs(dx) < 230 && p.alive) {
              e.cd = Math.max(0.9, 1.9 - mission * 0.12);
              var dir = dx > 0 ? 1 : -1;
              ebullets.push({
                x: e.x + (dir > 0 ? e.w : -4), y: e.y - 11,
                vx: dir * 150, w: 4, h: 2, life: 3
              });
              api.sfx.blip();
            }
          }

          /* sentuhan badan */
          if (p.alive && overlap({ x: p.x - 7, y: p.y - PLAYER_H, w: PLAYER_W, h: PLAYER_H },
                                 { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h })) {
            hurt();
          }

          /* jauh di belakang kamera -> buang */
          if (e.x < cam - 60 || e.x > cam + W + 200) {
            if (e.x < cam - 60) enemies.splice(i, 1);
          }
        }
      }

      function updateBullets(dt) {
        var s = dt / 1000;
        var i, b;

        for (i = bullets.length - 1; i >= 0; i--) {
          b = bullets[i];
          b.x += b.vx * s;
          b.y += b.vy * s;
          b.life -= s;

          var hitSomething = false;
          for (var j = enemies.length - 1; j >= 0; j--) {
            var e = enemies[j];
            if (overlap(b, { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h })) {
              e.hp -= 1;
              e.hurt = 0.12;
              hitSomething = true;
              if (e.hp <= 0) {
                boom(e.x, e.y - 8);
                self.score += e.kind === 'charger' ? 150 : 100;
                api.hi.set('metalslug', self.score);
                enemies.splice(j, 1);
              } else {
                api.sfx.hit();
              }
              break;
            }
          }
          if (hitSomething || b.life <= 0 || b.x < cam - 20 || b.x > cam + W + 20) {
            bullets.splice(i, 1);
          }
        }

        for (i = ebullets.length - 1; i >= 0; i--) {
          b = ebullets[i];
          b.x += b.vx * s;
          b.life -= s;
          if (p.alive && overlap(b, { x: p.x - 7, y: p.y - PLAYER_H, w: PLAYER_W, h: PLAYER_H })) {
            hurt();
            ebullets.splice(i, 1);
            continue;
          }
          if (b.life <= 0 || b.x < cam - 20 || b.x > cam + W + 20) ebullets.splice(i, 1);
        }
      }

      function updateParts(dt) {
        var s = dt / 1000;
        for (var i = parts.length - 1; i >= 0; i--) {
          parts[i].t += s;
          if (parts[i].t > parts[i].life) parts.splice(i, 1);
        }
        if (shake > 0) shake = Math.max(0, shake - s * 18);
        if (banner > 0) banner -= s;
      }

      /* ============================================================
         GAMBAR
         ============================================================ */
      function drawClouds(ctx) {
        var off = (cam * 0.18) % 220;
        for (var i = -1; i < 3; i++) {
          var cx = i * 220 - off;
          L.shadeLight(ctx, cx + 20, 26, 40, 5);
          L.shadeLight(ctx, cx + 28, 21, 24, 6);
          L.shadeLight(ctx, cx + 130, 44, 30, 4);
        }
      }

      function drawMountains(ctx) {
        var off = (cam * 0.32) % 240;
        for (var i = -1; i < 3; i++) {
          var bx = i * 240 - off;
          /* gunung segitiga dari dither ringan */
          for (var y = 0; y < 46; y += 2) {
            var w = (y * 2.2);
            L.shadeLight(ctx, bx + 60 - w / 2, 104 - y, w, 2);
          }
          for (var y2 = 0; y2 < 30; y2 += 2) {
            var w2 = (y2 * 1.7);
            L.shadeLight(ctx, bx + 150 - w2 / 2, 108 - y2, w2, 2);
          }
        }
      }

      function drawMidLayer(ctx) {
        var off = (cam * 0.55) % 120;
        for (var i = -1; i < 4; i++) {
          var bx = i * 120 - off;

          /* pohon palem */
          L.box(ctx, bx + 30, 108, 2, 40, L.PAL.ink);
          L.box(ctx, bx + 22, 104, 10, 3, L.PAL.ink);
          L.box(ctx, bx + 30, 104, 12, 3, L.PAL.ink);
          L.box(ctx, bx + 24, 99, 8, 3, L.PAL.ink);
          L.box(ctx, bx + 34, 99, 8, 3, L.PAL.ink);

          /* pagar kayu di latar (bukan objek solid) */
          L.shadeLight(ctx, bx + 70, 126, 28, 22);
          L.box(ctx, bx + 70, 126, 28, 2, L.PAL.ink);
          for (var s = 0; s < 5; s++) {
            L.box(ctx, bx + 72 + s * 6, 128, 2, 20, L.PAL.ink);
          }
        }
      }

      function drawGround(ctx) {
        L.box(ctx, 0, GROUND, W, H - GROUND, L.PAL.ink);
        L.shade(ctx, 0, GROUND, W, 3);

        /* tekstur tanah: garis putus-putus */
        var start = Math.floor(cam / 18) * 18;
        for (var x = start; x < cam + W; x += 18) {
          var sx = Math.round(x - cam);
          L.box(ctx, sx, GROUND + 11, 9, 2, L.PAL.bg2);
          L.box(ctx, sx + 10, GROUND + 21, 6, 2, L.PAL.bg2);
        }
      }

      /* prajurit: y = titik kaki */
      function drawSoldier(ctx, x, y, face, run, opts) {
        opts = opts || {};
        var col = opts.color || L.PAL.ink;
        var cx = Math.round(x);
        var cy = Math.round(y);
        var legSwing = run ? Math.round(Math.sin(run) * 3) : 0;

        /* helm */
        L.box(ctx, cx - 7, cy - 22, 14, 5, col);
        if (opts.enemy) {
          /* musuh: helm berjambul, tanpa brim — siluet berbeda dari pemain */
          L.box(ctx, cx - 2, cy - 25, 4, 3, col);
        } else {
          L.box(ctx, cx - 8, cy - 18, 16, 2, col);
        }
        /* muka */
        L.box(ctx, cx - 5, cy - 16, 10, 5, col);
        /* badan */
        L.box(ctx, cx - 6, cy - 11, 12, 8, col);
        /* ikat pinggang */
        L.box(ctx, cx - 6, cy - 4, 12, 1, L.PAL.mid);
        /* kaki */
        L.box(ctx, cx - 6, cy - 3, 5, 3 + legSwing, col);
        L.box(ctx, cx + 1, cy - 3, 5, 3 - legSwing, col);
        /* senapan */
        if (opts.gun !== false) {
          if (face > 0) {
            L.box(ctx, cx + 5, cy - 14, 11, 3, col);
            L.box(ctx, cx + 14, cy - 13, 4, 1, col);
          } else {
            L.box(ctx, cx - 16, cy - 14, 11, 3, col);
            L.box(ctx, cx - 18, cy - 13, 4, 1, col);
          }
        }
      }

      function drawPlayer(ctx) {
        if (!p.alive) return;
        if (p.inv > 0 && Math.floor(p.inv * 14) % 2 === 0) return;

        drawSoldier(ctx, p.x, p.y, p.face, p.run, { color: L.PAL.ink });

        /* kilatan moncong */
        if (p.shootCd > 0.11) {
          var mx = p.face > 0 ? p.x + 17 : p.x - 21;
          var my = p.aimUp ? p.y - 25 : p.y - 15;
          L.box(ctx, mx, my, 5, 4, L.PAL.ink);
          L.box(ctx, mx + (p.face > 0 ? -3 : 3), my + 1, 3, 2, L.PAL.mid);
        }
      }

      function drawEnemies(ctx) {
        for (var i = 0; i < enemies.length; i++) {
          var e = enemies[i];
          var ex = Math.round(e.x - cam);
          if (ex < -30 || ex > W + 30) continue;

          if (e.hurt > 0) {
            L.shade(ctx, ex - 7, e.y - 18, 14, 18);
            continue;
          }

          if (e.kind === 'charger') {
            /* penyerbu: tanpa brim helm, bawa bilah */
            var swing = Math.round(Math.sin(e.anim * 14) * 3);
            L.box(ctx, ex - 5, e.y - 19, 11, 4, L.PAL.ink);
            L.box(ctx, ex - 4, e.y - 15, 9, 4, L.PAL.ink);
            L.box(ctx, ex - 5, e.y - 11, 11, 7, L.PAL.ink);
            L.box(ctx, ex - 5, e.y - 4, 4, 4 + swing, L.PAL.ink);
            L.box(ctx, ex + 1, e.y - 4, 4, 4 - swing, L.PAL.ink);
            L.box(ctx, ex + 5, e.y - 14, 8, 2, L.PAL.ink);
          } else {
            drawSoldier(ctx, ex, e.y, -1, e.anim * 6, { color: L.PAL.ink, enemy: true });
          }
        }
      }

      function drawBullets(ctx) {
        var i;
        for (i = 0; i < bullets.length; i++) {
          var b = bullets[i];
          var bx = Math.round(b.x - cam);
          /* peluru pemain: lebih panjang supaya terbaca seperti tracer */
          L.box(ctx, bx, b.y, 10, 3, L.PAL.ink);
          L.box(ctx, bx + 3, b.y + 1, 4, 1, L.PAL.bg2);
          L.box(ctx, bx - 4, b.y + 1, 3, 1, L.PAL.mid);
        }
        for (i = 0; i < ebullets.length; i++) {
          var eb = ebullets[i];
          var ex = Math.round(eb.x - cam);
          L.box(ctx, ex, eb.y, 5, 3, L.PAL.ink);
          L.box(ctx, ex + 1, eb.y + 1, 2, 1, L.PAL.bg2);
          L.box(ctx, ex + 5, eb.y + 1, 2, 1, L.PAL.mid);
        }
      }

      function drawParts(ctx) {
        for (var i = 0; i < parts.length; i++) {
          var pt = parts[i];
          var k = pt.t / pt.life;
          var r = Math.round(3 + k * 12);
          var x = Math.round(pt.x - cam - r);
          var y = Math.round(pt.y - r);
          if (pt.kind === 'boom') {
            if (k < 0.6) L.shade(ctx, x, y, r * 2, r * 2);
            L.frame(ctx, x, y, r * 2, r * 2, L.PAL.ink);
            if (k < 0.35) L.box(ctx, x + r - 2, y + r - 2, 4, 4, L.PAL.ink);
          }
        }
      }

      function drawHud(ctx) {
        L.text(ctx, 'SCORE ' + self.score, 4, 3, 8, L.PAL.ink);
        L.text(ctx, 'M' + mission, W / 2 - 8, 3, 8, L.PAL.ink);

        /* nyawa */
        for (var i = 0; i < 3; i++) {
          var hx = W - 12 - i * 12;
          var hy = 4;
          if (i < p.hp) {
            L.box(ctx, hx, hy + 1, 7, 5, L.PAL.ink);
            L.box(ctx, hx + 1, hy, 5, 1, L.PAL.ink);
            L.box(ctx, hx + 2, hy + 6, 3, 1, L.PAL.ink);
          } else {
            L.frame(ctx, hx, hy, 7, 7, L.PAL.mid);
          }
        }

        if (banner > 0) {
          L.box(ctx, 60, 70, 200, 34, L.PAL.ink);
          L.textCenter(ctx, 'MISSION ' + (mission - 1), 160, 78, 8, L.PAL.bg);
          L.textCenter(ctx, 'CLEAR!', 160, 90, 8, L.PAL.bg);
        }
      }

      /* ============================================================
         KONTRAK
         ============================================================ */
      self.reset = function () {
        initScene();
        self.state = 'playing';
        api.sfx.start();
      };

      self.update = function (dt) {
        if (self.state !== 'playing') return;
        var s = dt / 1000;

        updatePlayer(dt);
        updateEnemies(dt);
        updateBullets(dt);
        updateParts(dt);

        /* kamera mengikuti pemain */
        var target = Math.max(0, Math.min(p.x - 110, MISSION_LEN - W));
        cam += (target - cam) * Math.min(1, s * 8);

        /* spawner */
        spawnTimer -= s;
        if (spawnTimer <= 0 && enemies.length < 7) {
          spawnTimer = Math.max(0.75, 2.1 - mission * 0.18);
          var kind = Math.random() < 0.3 ? 'charger' : 'grunt';
          enemies.push(spawnEnemy(kind, cam + W + 20));
        }
      };

      self.input = function (action) {
        if (self.state !== 'playing') return;
        if (action === 'a') jump();
        else if (action === 'b') shoot();
      };

      self.render = function (ctx) {
        var sx = 0, sy = 0;
        if (shake > 0) {
          sx = Math.round((Math.random() - 0.5) * shake);
          sy = Math.round((Math.random() - 0.5) * shake);
        }

        ctx.save();
        ctx.translate(sx, sy);

        L.clear(ctx, L.PAL.bg);
        drawClouds(ctx);
        drawMountains(ctx);
        drawMidLayer(ctx);
        drawGround(ctx);
        drawEnemies(ctx);
        drawPlayer(ctx);
        drawBullets(ctx);
        drawParts(ctx);
        drawHud(ctx);

        ctx.restore();
      };

      initScene();
      self.render(api.ctx);

      self.debugState = function () {
        return {
          state: self.state, score: self.score, hp: p.hp,
          px: Math.round(p.x), py: Math.round(p.y),
          enemies: enemies.length, mission: mission, cam: Math.round(cam),
          bullets: bullets.length, ebullets: ebullets.length
        };
      };

      return self;
    }
  };
})();
