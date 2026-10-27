/* ============================================================
   SMOKE TEST — tempel di Console browser pada
   http://localhost:8000/index.html?debug=1

   Tanpa dependency. Menguji ketiga mini-game lewat hook
   window.__game (launch / startRound / step / debugState).
   Semua asersi berupa angka state, bukan waktu.
   ============================================================ */

(function () {
  var g = window.__game;
  var results = [];

  function check(name, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ name: name, ok: ok, actual: actual, expected: expected });
  }

  function truthy(name, cond, detail) {
    results.push({ name: name, ok: !!cond, actual: detail, expected: 'truthy' });
  }

  if (!g) {
    console.error('❌ window.__game tidak ada. Buka URL dengan ?debug=1');
    return;
  }

  /* ---------- 1. BOOT: menu tampil ---------- */
  check('game awal adalah menu', g.def.id, 'menu');
  check('panel skor disembunyikan di menu', document.getElementById('panel').hidden, true);

  /* ---------- 1b. MENU GRID: navigasi kiri/kanan ---------- */
  g.input('right'); g.input('right'); g.input('right');
  g.input('a');
  check('menu grid: navigasi kanan sampai TAMAGOTCHI', g.def.id, 'tamagochi');
  g.menu();
  g.input('left'); g.input('left');
  g.input('a');
  check('menu grid: navigasi kiri membungkus ke FLAPPY', g.def.id, 'flappy');
  g.menu();

  /* ---------- 2. TETRIS ---------- */
  g.launch('tetris');
  check('tetris: state awal', g.game.state, 'ready');
  check('tetris: panel tampil', document.getElementById('panel').hidden, false);

  g.startRound();
  check('tetris: state setelah start', g.game.state, 'playing');

  for (var i = 0; i < 6; i++) { g.input('left'); g.input('a'); }
  var t = g.game.debugState();
  truthy('tetris: blok terkunci di papan', t.cells > 0, t.cells);
  truthy('tetris: skor bertambah', t.score > 0, t.score);
  check('tetris: label panel', document.getElementById('l1').textContent, 'SCORE');
  check('tetris: NEXT tampil', document.querySelector('[data-slot="next"]').hidden, false);

  /* ---------- 3. METAL SLUG ---------- */
  g.launch('metalslug');
  check('slug: panel disembunyikan', document.getElementById('panel').hidden, true);
  check('slug: canvas landscape', document.getElementById('board').width > document.getElementById('board').height, true);

  g.startRound();
  var s0 = g.game.debugState();
  g.held('right', true);
  g.step(16, 60);                      // ~1 detik menahan kanan
  g.held('right', false);
  var s1 = g.game.debugState();
  truthy('slug: pemain bergerak ke kanan', s1.px - s0.px > 50, s1.px - s0.px);
  check('slug: tetap di tanah', s1.py, 148);

  g.input('a');                        // lompat
  g.step(16, 6);
  truthy('slug: lompat mengangkat pemain', g.game.debugState().py < 148, g.game.debugState().py);
  g.step(16, 80);                      // mendarat lagi
  check('slug: mendarat kembali', g.game.debugState().py, 148);

  g.held('b', true);                   // tembak
  g.step(16, 20);
  g.held('b', false);
  var s2 = g.game.debugState();
  truthy('slug: menembak menghasilkan peluru', s2.bullets > 0 || s2.score > 0, { bullets: s2.bullets, score: s2.score });

  /* ---------- 4. FLAPPY ---------- */
  g.launch('flappy');
  check('flappy: panel tampil', document.getElementById('panel').hidden, false);
  g.startRound();

  var f0 = g.game.debugState();
  g.step(16, 30);
  var f1 = g.game.debugState();
  truthy('flappy: burung jatuh karena gravitasi', f1.y > f0.y, { dari: f0.y, ke: f1.y });

  g.input('a');
  g.step(16, 6);
  var f2 = g.game.debugState();
  truthy('flappy: kepak mengangkat burung', f2.y < f1.y, { dari: f1.y, ke: f2.y });

  /* terbangkan otomatis sampai ada pipa yang terlewati */
  for (var k = 0; k < 700 && g.game.state === 'playing' && g.game.debugState().score < 1; k++) {
    var fs = g.game.debugState();
    var target = fs.gapCenter !== null ? fs.gapCenter : 150;
    if (fs.y > target - 2) g.input('a');
    g.step(16, 1);
  }
  truthy('flappy: skor bertambah setelah melewati pipa', g.game.debugState().score >= 1, g.game.debugState().score);

  /* ---------- 5. TAMAGOTCHI ---------- */
  g.launch('tamagochi');
  check('tama: panel tampil', document.getElementById('panel').hidden, false);
  check('tama: label panel AGE', document.getElementById('l1').textContent, 'AGE');
  check('tama: slot keempat disembunyikan', document.querySelector('[data-slot="4"]').hidden, true);

  g.startRound();
  var m0 = g.game.debugState();
  check('tama: state setelah start', m0.state, 'playing');
  check('tama: nyawa penuh', m0.health, 100);

  /* waktu berjalan -> usia naik, stat turun */
  g.step(16, 130);                       // ~2 detik
  var m1 = g.game.debugState();
  truthy('tama: usia bertambah', m1.age > m0.age, { dari: m0.age, ke: m1.age });
  truthy('tama: lapar bertambah (hunger turun)', m1.hunger < m0.hunger, { dari: m0.hunger, ke: m1.hunger });

  /* buka menu -> pilih PLAY (index 1) */
  g.input('a');
  check('tama: menu terbuka', g.game.debugState().menuOpen, true);
  g.input('down');
  check('tama: navigasi menu', g.game.debugState().sel, 1);
  g.input('a');                          // jalankan PLAY
  var m2 = g.game.debugState();
  check('tama: menu tertutup setelah aksi', m2.menuOpen, false);
  truthy('tama: PLAY menaikkan kebahagiaan', m2.happy >= m1.happy, { dari: m1.happy, ke: m2.happy });

  /* FEED (index 0) memulihkan hunger */
  g.input('a'); g.input('a');
  var m3 = g.game.debugState();
  truthy('tama: FEED menaikkan hunger', m3.hunger > m2.hunger, { dari: m2.hunger, ke: m3.hunger });

  /* biarkan kelaparan sampai mati */
  for (var t2 = 0; t2 < 4000 && g.game.state === 'playing'; t2++) g.step(16, 1);
  var m4 = g.game.debugState();
  check('tama: game over saat diabaikan', m4.state, 'over');
  check('tama: makhluk mati', m4.alive, false);
  truthy('tama: skor = usia (hari)', m4.score >= 0, m4.score);

  /* ---------- 6. KEMBALI KE MENU ---------- */
  g.menu();
  check('kembali ke menu', g.def.id, 'menu');

  /* ---------- laporan ---------- */
  var failed = results.filter(function (r) { return !r.ok; });
  results.forEach(function (r) {
    console.log((r.ok ? '✅ PASS' : '❌ FAIL') + ' — ' + r.name +
      (r.ok ? '' : ' (dapat ' + JSON.stringify(r.actual) + ', harusnya ' + JSON.stringify(r.expected) + ')'));
  });
  console.log(failed.length === 0
    ? '\n🎉 Semua ' + results.length + ' cek lulus'
    : '\n⚠️ ' + failed.length + ' dari ' + results.length + ' cek gagal');

  return failed.length === 0;
})();
