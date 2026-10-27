/* ============================================================
   TAMAGOTCHI — VIRTUAL PET (1996)
   Rawat makhluk pixel: beri makan, mainkan, tidurkan, bersihkan.
   Tiga stat turun seiring waktu; kalau ada yang habis, nyawa
   berkurang. Jaga terus sampai makhluk tumbuh besar.
   ============================================================ */

window.MINIGAME = window.MINIGAME || {};

(function () {
  'use strict';

  var W = 180;
  var H = 320;

  /* 1 "hari" Tamagotchi = 6 detik nyata */
  var DAY_LEN = 6;

  /* ---------- sprite 12×10 (digambar scale 2 → 24×20) ----------
     '#' = tinta, '.' = transparan (menampilkan warna layar)      */
  var SPR = {
    idle: [
      '...######...',
      '..########..',
      '.##########.',
      '############',
      '##..####..##',
      '##..####..##',
      '############',
      '.##########.',
      '..########..',
      '...######...'
    ],
    eat: [
      '...######...',
      '..########..',
      '.##########.',
      '############',
      '##..####..##',
      '##..####..##',
      '############',
      '####....####',
      '..########..',
      '...######...'
    ],
    sleep: [
      '...######...',
      '..########..',
      '.##########.',
      '############',
      '############',
      '##..####..##',
      '############',
      '.##########.',
      '..########..',
      '...######...'
    ],
    happy: [
      '...######...',
      '..########..',
      '.##########.',
      '############',
      '##..####..##',
      '##..####..##',
      '############',
      '#..######..#',
      '..########..',
      '...######...'
    ],
    sad: [
      '...######...',
      '..########..',
      '.##########.',
      '############',
      '##..####..##',
      '##..####..##',
      '############',
      '.#..####..#.',
      '..########..',
      '...######...'
    ],
    dead: [
      '...######...',
      '..########..',
      '.##########.',
      '############',
      '#.#.####.#.#',
      '#.#.####.#.#',
      '############',
      '.#..####..#.',
      '..########..',
      '...######...'
    ],
    poop: [
      '...##...',
      '..####..',
      '.######.',
      '.######.',
      '..####..',
      '...##...'
    ]
  };

  function drawSprite(ctx, name, x, y, scale) {
    var rows = SPR[name];
    if (!rows) return;
    window.LCD.sprite(ctx, rows, x, y, scale || 2);
  }

  MINIGAME.tamagochi = {
    id: 'tamagochi',
    title: 'TAMAGOTCHI',
    w: W,
    h: H,
    boardMax: 244,
    usePanel: true,
    hint: 'A:MENU &middot; B:TUTUP',
    labels: { s1: 'AGE', v1: 0, s2: 'HI', v2: 0, s3: 'HEALTH', v3: 100 },

    create: function (api) {
      var L = window.LCD;

      var hunger, happy, energy, health, age, alive;
      var sleeping, eating, playing, cleaning;
      var poopList, msg, msgTimer, sel, menuOpen;
      var bobT, actT, face, nextPoop, tickAccum;
      var self = { state: 'ready', score: 0 };

      var ACTIONS = ['FEED', 'PLAY', 'SLEEP', 'CLEAN'];

      function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

      function days() { return Math.floor(age / DAY_LEN); }

      function resetStats() {
        hunger = 80; happy = 80; energy = 80; health = 100; age = 0;
        alive = true;
        sleeping = false; eating = false; playing = false; cleaning = false;
        poopList = [];
        msg = ''; msgTimer = 0;
        sel = 0; menuOpen = false;
        bobT = 0; actT = 0; face = 'idle';
        nextPoop = 8 + Math.random() * 12;
        tickAccum = 0;
        self.score = 0;
      }

      function pushPanel() {
        api.panel({
          s1: 'AGE', v1: days(),
          s2: 'HI', v2: api.hi.get('tamagochi'),
          s3: 'HEALTH', v3: Math.round(health)
        });
      }

      self.reset = function () {
        resetStats();
        self.state = 'playing';
        api.sfx.start();
        pushPanel();
      };

      function setMsg(txt) {
        msg = txt; msgTimer = 1.4;
      }

      function spawnPoop() {
        var px = 18 + Math.random() * (W - 54);
        var py = 206 + Math.random() * 54;
        poopList.push({ x: px, y: py });
      }

      /* ============================================================
         UPDATE
         ============================================================ */
      self.update = function (dt) {
        var s = dt / 1000;
        bobT += s;
        actT += s;
        if (msgTimer > 0) msgTimer -= s;

        /* --- tik per detik --- */
        tickAccum += s;
        while (tickAccum >= 1) {
          tickAccum -= 1;
          if (self.state !== 'playing' || !alive) continue;

          age += 1;

          if (sleeping) {
            energy = clamp(energy + 12, 0, 100);
            hunger = clamp(hunger - 5, 0, 100);
            happy = clamp(happy - 1, 0, 100);
          } else {
            energy = clamp(energy - 3, 0, 100);
            hunger = clamp(hunger - 4, 0, 100);
            happy = clamp(happy - 2, 0, 100);
          }

          if (!sleeping && age >= nextPoop) {
            spawnPoop();
            nextPoop = age + 10 + Math.floor(Math.random() * 20);
          }

          /* nyawa turun hanya kalau ada stat kritis */
          var drain = 0;
          if (hunger <= 0) drain += 8;
          if (happy <= 0) drain += 5;
          if (energy <= 0) drain += 5;
          if (drain > 0) {
            health = clamp(health - drain, 0, 100);
          } else if (health < 100 && hunger > 50 && happy > 50 && energy > 50) {
            health = clamp(health + 2, 0, 100);
          }

          if (health <= 0 && alive) {
            alive = false;
            sleeping = false; eating = false; playing = false;
            self.state = 'over';
            api.hi.set('tamagochi', days());
            api.sfx.die();
          }

          self.score = days();
          pushPanel();
        }

        /* --- timer aksi sementara --- */
        if (eating && actT > 1.2) eating = false;
        if (playing && actT > 1.0) playing = false;
        if (cleaning && actT > 0.6) cleaning = false;

        /* --- bangun otomatis kalau energi penuh --- */
        if (sleeping && energy >= 100) {
          sleeping = false;
          setMsg('WAKE UP!');
          api.sfx.confirm();
        }

        /* --- pilih ekspresi --- */
        if (!alive) face = 'dead';
        else if (eating) face = 'eat';
        else if (sleeping) face = 'sleep';
        else if (playing) face = 'happy';
        else if (happy < 30 || hunger < 30 || energy < 20) face = 'sad';
        else face = 'idle';
      };

      /* ============================================================
         INPUT
         ============================================================ */
      self.input = function (action) {
        if (self.state !== 'playing' || !alive) return;

        if (menuOpen) {
          if (action === 'up') { sel = (sel - 1 + ACTIONS.length) % ACTIONS.length; api.sfx.blip(); }
          if (action === 'down') { sel = (sel + 1) % ACTIONS.length; api.sfx.blip(); }
          if (action === 'b') { menuOpen = false; api.sfx.back(); }
          if (action === 'a') { doAction(ACTIONS[sel]); menuOpen = false; }
          return;
        }

        if (action === 'a') { menuOpen = true; sel = 0; api.sfx.select(); }
      };

      function doAction(name) {
        actT = 0;

        if (name === 'FEED') {
          if (sleeping) { setMsg('Zzz...'); return; }
          if (hunger >= 100) { setMsg('FULL!'); api.sfx.back(); return; }
          eating = true;
          hunger = clamp(hunger + 35, 0, 100);
          happy = clamp(happy + 5, 0, 100);
          setMsg('YUMMY!');
          api.sfx.confirm();

        } else if (name === 'PLAY') {
          if (sleeping) { setMsg('Zzz...'); return; }
          if (energy < 15) { setMsg('TIRED'); api.sfx.back(); return; }
          playing = true;
          happy = clamp(happy + 30, 0, 100);
          energy = clamp(energy - 15, 0, 100);
          hunger = clamp(hunger - 5, 0, 100);
          setMsg('SO FUN!');
          api.sfx.point();

        } else if (name === 'SLEEP') {
          if (sleeping) {
            sleeping = false;
            setMsg('WAKE UP!');
            api.sfx.confirm();
          } else {
            sleeping = true;
            setMsg('Zzz...');
            api.sfx.select();
          }

        } else if (name === 'CLEAN') {
          if (sleeping) { setMsg('Zzz...'); return; }
          if (poopList.length === 0) { setMsg('CLEAN!'); api.sfx.back(); return; }
          cleaning = true;
          poopList = [];
          happy = clamp(happy + 15, 0, 100);
          setMsg('CLEAN!');
          api.sfx.clear();
        }

        pushPanel();
      }

      /* ============================================================
         RENDER
         ============================================================ */
      function drawBar(ctx, x, y, w, h, val) {
        L.frame(ctx, x, y, w, h, L.PAL.ink);
        var fill = Math.round((w - 4) * (clamp(val, 0, 100) / 100));
        if (fill > 0) L.box(ctx, x + 2, y + 2, fill, h - 4, L.PAL.ink);
      }

      function drawStats(ctx) {
        var y = 26;
        L.text(ctx, 'HUNGER', 8, y, 8, L.PAL.ink);
        drawBar(ctx, 66, y, 106, 9, hunger);
        y += 16;
        L.text(ctx, 'HAPPY', 8, y, 8, L.PAL.ink);
        drawBar(ctx, 66, y, 106, 9, happy);
        y += 16;
        L.text(ctx, 'ENERGY', 8, y, 8, L.PAL.ink);
        drawBar(ctx, 66, y, 106, 9, energy);
        y += 16;
        L.text(ctx, 'HEALTH', 8, y, 8, L.PAL.ink);
        drawBar(ctx, 66, y, 106, 9, health);
      }

      function drawPoop(ctx) {
        for (var i = 0; i < poopList.length; i++) {
          drawSprite(ctx, 'poop', Math.round(poopList[i].x), Math.round(poopList[i].y), 2);
        }
      }

      function drawCreature(ctx) {
        var bob = Math.round(Math.sin(bobT * 2.4) * 2);
        var sx = Math.round(W / 2 - 12);   /* 12 kolom × scale 2 ÷ 2 */
        var sy = 150 + bob;
        drawSprite(ctx, face, sx, sy, 2);

        if (sleeping) {
          var zz = Math.floor(bobT * 3) % 3;
          for (var i = 0; i <= zz; i++) {
            L.text(ctx, 'Z', sx + 26 + i * 7, sy - 6 - i * 10, 10, L.PAL.ink);
          }
        }

        if (msgTimer > 0 && Math.floor(msgTimer * 6) % 2 === 0) {
          L.textCenter(ctx, msg, W / 2, sy - 24, 8, L.PAL.ink);
        }
      }

      function drawMenu(ctx) {
        if (!menuOpen) return;
        var mw = 104, mh = 70;
        var mx = Math.round((W - mw) / 2), my = 216;
        L.box(ctx, mx, my, mw, mh, L.PAL.bg2);
        L.frame(ctx, mx, my, mw, mh, L.PAL.ink);
        for (var i = 0; i < ACTIONS.length; i++) {
          var iy = my + 4 + i * 16;
          if (i === sel) {
            L.box(ctx, mx + 2, iy, mw - 4, 14, L.PAL.ink);
            L.text(ctx, ACTIONS[i], mx + 8, iy + 3, 8, L.PAL.bg);
          } else {
            L.text(ctx, ACTIONS[i], mx + 8, iy + 3, 8, L.PAL.ink);
          }
        }
      }

      self.render = function (ctx) {
        L.clear(ctx, L.PAL.bg);
        drawStats(ctx);
        drawPoop(ctx);
        drawCreature(ctx);
        drawMenu(ctx);
      };

      /* state awal untuk layar "PRESS A" */
      resetStats();
      self.render(api.ctx);

      self.debugState = function () {
        return {
          state: self.state, score: self.score, age: age,
          hunger: Math.round(hunger), happy: Math.round(happy),
          energy: Math.round(energy), health: Math.round(health),
          alive: alive, sleeping: sleeping, menuOpen: menuOpen, sel: sel,
          poop: poopList.length, face: face
        };
      };

      return self;
    }
  };
})();
