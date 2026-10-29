# Kebijakan Keamanan

Repo: **andriyfm/tetris-browser-game**

MINI ARCADE adalah game statis (HTML + CSS + JavaScript murni) tanpa backend, tanpa login,
dan tanpa dependency runtime. Data yang disimpan hanya skor tertinggi di `localStorage`
browser kamu sendiri. Meski begitu, laporan keamanan tetap kami anggap serius — misalnya
celah XSS, masalah di workflow GitHub Actions, atau hal lain yang bisa disalahgunakan.

## Versi yang didukung

Hanya versi terbaru di branch `main` (yang juga tayang di
<https://andriyfm.github.io/tetris-browser-game/>).

## Cara melaporkan celah keamanan

**Jangan laporkan celah keamanan lewat issue, PR, atau diskusi publik.**

Gunakan fitur **private vulnerability reporting** GitHub:

1. Buka tab **Security** di repo ini.
2. Klik **Report a vulnerability**
   (atau langsung ke <https://github.com/andriyfm/tetris-browser-game/security/advisories/new>).
3. Jelaskan masalahnya: apa yang terjadi, langkah reproduksi, browser/perangkat, dan
   dampaknya menurutmu.

Laporan ini hanya bisa dilihat oleh kamu dan maintainer.

## Apa yang bisa kamu harapkan

- Konfirmasi bahwa laporan sudah diterima secepatnya (target: dalam beberapa hari).
- Kabar perkembangan selama investigasi dan perbaikan.
- Nama kamu dicantumkan di advisory sebagai pelapor, kalau kamu mau.

Mohon beri waktu untuk perbaikan sebelum membagikan detail celah ke publik. Terima kasih
sudah membantu menjaga project ini tetap aman!
