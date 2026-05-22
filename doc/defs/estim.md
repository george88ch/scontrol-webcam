# Estim Page

Erstelle ein neue Page für abspilen von Estim Sounds.

Verlagere dazu die Sound Funktionen, die aktuell in der SoundPage implemetiert sind in die neue Page.

Die Calibration soll auf der neuen Page erfolgen.

Die EstimPage hört auf einen RTDB Command Queue mit einem Realtime Listner.

Die SoundPage spielt den Sond nicht merh direkt ab, sondern setzt einen Command in Queue ab und wartet bis dieser beendet ist (auch über Realtime Listener).

Bevor die SoundPage den Command absetzt, soll der Text als TTS (WebRTC für die erste Version) abgespielt werden.

Sorge dafür, dass immer nur ein Estim Sound läuft. Die Commands müssen nach Abschluss nicht mehr vorhanden sein (sollen gelöscht werden).

Die Estim Page soll vor dem Start einer Sequenz von der SoundPage aus aufgerufen werden. Als Link kopierbar und/oder QR Code. Für die Command Queue wird `estim_{userId}` verwendet. Die EstimPage ist nur für angemeldete User verfügbar und hört auf die Queue des eingeloggten Users.
