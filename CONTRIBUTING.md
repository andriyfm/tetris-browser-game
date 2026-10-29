# Panduan Kontribusi

Halo, makasih sudah mampir ke **andriyfm/tetris-browser-game** (MINI ARCADE)! 🎮
Kontribusi sekecil apa pun sangat dihargai — benerin typo, lapor bug, sampai nambah fitur.

Dengan ikut berkontribusi, kamu setuju mengikuti [Kode Etik](CODE_OF_CONDUCT.md) project ini.
Untuk masalah keamanan, **jangan** buka issue publik — ikuti [SECURITY.md](SECURITY.md).

## Daftar isi

- [Menjalankan secara lokal](#menjalankan-secara-lokal)
- [Debug hook `?debug=1`](#debug-hook-debug1)
- [Menjalankan smoke test](#menjalankan-smoke-test)
- [Gaya kode](#gaya-kode)
- [Branch & commit](#branch--commit)
- [Alur pull request](#alur-pull-request)
- [Memilih `good first issue`](#memilih-good-first-issue)

## Menjalankan secara lokal

Game-nya **tanpa install, tanpa build step, tanpa dependency**.

```bash
git clone https://github.com/<username-kamu>/tetris-browser-game.git
cd tetris-browser-game
python3 -m http.server 8000
# buka http://localhost:8000
```

Membuka `index.html` langsung (double-click) juga bisa, tapi lewat server lokal lebih
mirip kondisi di GitHub Pages.

## Debug hook `?debug=1`

Tambahkan `?debug=1` di URL (contoh `http://localhost:8000/index.html?debug=1`) untuk
membuka `window.__game` di Console:

```js
__game.launch('metalslug')     // pindah game: menu / tetris / metalslug / flappy / tamagochi
__game.startRound()            // mulai ronde
__game.input('a')              // kirim aksi (left/right/up/down/a/b/start/pause/reset)
__game.held('right', true)     // tahan tombol
__game.step(16, 60)            // majukan 60 frame × 16 ms tanpa menunggu rAF
__game.game.debugState()       // angka state: skor, hp, posisi, jumlah musuh/pipa
__game.menu()                  // kembali ke menu
```

## Menjalankan smoke test

Smoke test ada di `tests/smoke.console.js` (38 cek: menu, Tetris, Metal Slug, Flappy,
Tamagotchi). Ada dua cara menjalankannya — hasilnya sama.

**1. Manual di Console browser (tanpa install apa pun)**

1. Jalankan server lokal, buka `http://localhost:8000/index.html?debug=1`.
2. Buka DevTools → Console, tempel seluruh isi `tests/smoke.console.js`, Enter.
3. Semua baris harus `✅ PASS` dan hasil akhirnya `true`.

**2. Runner headless (sama seperti CI)**

Butuh Node.js 20+. Playwright hanya dipakai untuk tes (devDependency), game-nya tetap
tanpa dependency.

```bash
npm ci
npx playwright install chromium
npm test            # = node tests/run-smoke.mjs
```

Runner menyalakan static server kecil sendiri, membuka `index.html?debug=1` di Chromium
headless, menjalankan smoke test, lalu **gagal** kalau ada cek yang FAIL, ada
`console.error` / error JavaScript, atau ada file yang gagal dimuat.

Kalau kamu sudah punya server yang jalan: `BASE_URL=http://127.0.0.1:8000 npm test`.

Workflow CI (`.github/workflows/ci.yml`, job `smoke-test`) menjalankan hal yang sama di
setiap pull request dan push ke `main`.

Kalau kamu menambah perilaku baru yang bisa dites lewat angka state, tambahkan cek-nya di
`tests/smoke.console.js` dan perbarui jumlah cek di README.

## Gaya kode

- **Vanilla JS, tanpa dependency, tanpa build step.** Jangan menambah library, framework,
  bundler, atau CDN untuk game-nya. File di-load lewat `<script>` biasa di `index.html`.
- Ikuti gaya yang sudah ada: IIFE + `'use strict'`, `var`, indentasi 2 spasi, titik koma,
  kutip tunggal, dan komentar blok `/* ==== */` untuk memisah bagian. Komentar boleh
  bahasa Indonesia seperti kode yang sudah ada.
- Gambar semua lewat toolkit `window.LCD` (`js/lcd.js`): palet 3 nada (`bg`, `mid`, `ink`),
  dither, teks pixel, dan SFX — supaya tampilannya tetap monokrom ala LCD.
- Fisika pakai **detik** (`dt / 1000`), timer UI pakai milidetik. `dt` sudah di-clamp 100 ms.
- **Kontrak game.** Setiap game mendaftar ke `window.MINIGAME` dengan bentuk:

  ```js
  MINIGAME.namagame = {
    id: 'namagame', title: 'NAMA', hint: 'teks bantuan di overlay',
    w: 180, h: 320,          // ukuran kanvas logis
    boardMax: 244,           // lebar maksimum layar (px)
    usePanel: true,          // tampilkan panel skor di samping layar?
    labels: { s1: 'SCORE', v1: 0, s2: 'HI', v2: 0 },
    create: function (api) {
      var self = { state: 'ready', score: 0 };
      self.reset  = function () { /* mulai ronde baru, state -> 'playing' */ };
      self.update = function (dt) { /* logika per frame */ };
      self.render = function (ctx) { /* gambar ke kanvas */ };
      self.input  = function (action) { /* left/right/up/down/a/b */ };
      self.debugState = function () { return { /* angka untuk smoke test */ }; };
      return self;
    }
  };
  ```

  `state` bernilai `'ready'`, `'playing'`, atau `'over'`. Skor tertinggi disimpan lewat
  `api.hi.get(id)` / `api.hi.set(id, skor)`. Lihat `js/flappy.js` sebagai contoh paling ringkas.
- Jaga aksesibilitas: tombol baru wajib punya teks atau `aria-label`.

## Branch & commit

Ikuti pola history yang sudah ada — prefix gaya *conventional commits*, deskripsi singkat
dalam bahasa Indonesia:

| Prefix | Untuk | Contoh |
| --- | --- | --- |
| `feat:` | fitur baru | `feat: tambah game Tamagotchi (virtual pet) sebagai game ke-4` |
| `fix:` | perbaikan bug | `fix: keyboard A/B berfungsi + menu jadi grid 1 baris` |
| `docs:` | dokumentasi | `docs: lengkapi daftar debug hook di README` |
| `chore:` | perawatan, CI, config | `chore: tambah workflow CI smoke test` |
| `test:` | smoke test | `test: tambah cek pause di Tetris` |
| `refactor:` | rapikan kode tanpa ubah perilaku | `refactor: pisahkan fisika pemain Metal Slug` |

Nama branch: `<prefix>/<deskripsi-singkat>`, misalnya `fix/hint-keyboard-enter`,
`feat/simpan-preferensi-suara`, `docs/debug-hook`.

Satu PR sebaiknya fokus ke satu hal. Commit kecil-kecil lebih gampang di-review.

## Alur pull request

1. **Fork** repo ini, lalu clone fork-mu.
2. Buat branch baru dari `main` (lihat konvensi di atas).
3. Kerjakan perubahannya, jalankan smoke test, dan coba manual di browser.
4. Push ke fork-mu, lalu buka **pull request ke `main`** di andriyfm/tetris-browser-game.
   Isi template PR (issue terkait, checklist, screenshot/GIF kalau ada perubahan visual).
5. **CI harus hijau** — job `smoke-test` wajib lulus.
6. **Review maintainer wajib.** PR hanya di-merge oleh maintainer setelah di-review.
   Mungkin ada permintaan perubahan; itu normal, bukan penolakan. 🙂

> **Catatan untuk kontributor pertama kali:** kalau ini PR pertamamu dari fork, GitHub
> menahan workflow CI sampai maintainer menyetujui eksekusinya ("Approve and run").
> Jadi wajar kalau status CI di PR-mu sempat "menunggu persetujuan" — itu fitur keamanan
> GitHub, bukan error di PR-mu.

## Memilih `good first issue`

1. Buka daftar [issue berlabel `good first issue`](https://github.com/andriyfm/tetris-browser-game/issues?q=is%3Aopen+label%3A%22good+first+issue%22).
2. Pilih yang belum ada assignee dan belum ada PR terkait.
3. Tulis komentar di issue-nya, misalnya *"Saya mau ambil ini"*, supaya tidak dobel
   dikerjakan orang lain.
4. Setiap issue punya bagian **Scope**, **Di luar scope**, **Acceptance criteria**, dan
   **Petunjuk file yang relevan** — kerjakan sesuai scope saja, ide tambahan bisa jadi
   issue baru.
5. Bingung atau mentok? Tanya saja di komentar issue. Tidak ada pertanyaan yang bodoh.

Label lain yang berguna: `help wanted` (butuh bantuan), `bug`, `enhancement`,
`documentation`, dan `question`.

Selamat ngoding! 🕹️
