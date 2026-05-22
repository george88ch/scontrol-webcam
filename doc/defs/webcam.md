# Webcam Page

Erstelle eine Webcam Page. Die Page zeigt in einen Canvas den Video Stream.

Die Video Framessollen mit faceapi, mediapipe und allenfalls weiteren Tools laufend Informationen liefern.

Die Frame Rate soll gewählt werden können (1 bis ca. 10 Frames pro Sekunde).

Die Informationen sollen in einem reaktiven Object nachgeführt werden (ref oder reactive). Sie werden später in einer RTDB nachgeführt.

Die Anzeige des Videostreams soll gespiegelt werden.

## Informationen

Die Informationen sind:

### Face API

- Ist ein Gesicht sichtbar?
- Ist der Mund offen/geschlossen?
- Schaut der User auf einen bstimmten Punkt?

### Poses

- Ist der Oberkörper sichtbar?
- Ist der ganze Körper sichtbar?
- Rechte hand erhoben?
- linke Hand erhoben?
- beide Hände erhoben?
- Beine gespreizt?
- sitzt, steht, kniet oder liegt der User?

### Movement

- Ist Bewegung sichtbar?
- Ist Bewegung in einem bestimmten Bereich sichtbar?

## Object Detection

- kommt später (openAI Vision)
