/* ============================================================
   SMOKE TEST — jalankan di Console browser pada
   http://localhost:8000/index.html?debug=1

   Tidak butuh dependency apa pun. Akan mencetak PASS/FAIL
   untuk perilaku inti: start, line clear, skor, game over.
   ============================================================ */

(function () {
  var T = window.__tetris;
  var results = [];

  function check(name, actual, expected) {
    var ok = JSON.stringify(actual) === JSON.stringify(expected);
    results.push({ name: name, ok: ok, actual: actual, expected: expected });
  }

  if (!T) {
    console.error('❌ window.__tetris tidak ada. Buka URL dengan ?debug=1');
    return;
  }

  /* 1. start game */
  T.start();
  check('state setelah start', T.state, 'playing');
  check('skor awal', T.score, 0);
  check('baris awal', T.lines, 0);

  /* 2. line clear: isi baris 19 kecuali kolom 0, lalu kunci 1 blok di lubang */
  var b = T.board.map(function (r) { return r.slice(); });
  for (var x = 1; x < 10; x++) b[19][x] = 1;
  T.setBoard(b);
  T.setPiece({ type: 'X', m: [[1]], x: 0, y: 19 });
  T.lockPiece();

  check('skor setelah 1 baris', T.score, 40);
  check('lines setelah 1 baris', T.lines, 1);

  /* 3. finishClear menghapus baris dan menggeser sisanya */
  T.finishClear();
  check('baris bawah kosong setelah clear', T.board[19].every(function (v) { return !v; }), true);

  /* 4. game over: blok baru tidak punya tempat di atas */
  var top = T.board.map(function (r, y) {
    var row = [];
    for (var i = 0; i < 10; i++) row.push(0);
    /* baris 0-2 penuh kecuali kolom 9, jadi tidak ada baris yang ter-clear */
    if (y <= 2) {
      for (var j = 0; j < 9; j++) row[j] = 1;
    }
    return row;
  });
  T.setBoard(top);
  T.setPiece({ type: 'O', m: [[1, 1], [1, 1]], x: 4, y: 10 });
  T.lockPiece();            // tidak ada baris penuh -> spawn() -> tabrakan -> over
  check('state akhir', T.state, 'over');

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
