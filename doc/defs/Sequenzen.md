# Sequenzen

Erstelle eine AI Funktion, die eine Sequenz erstellen/vorschlagen kann.

Mache das wie die 'rephrase' Funktion. Wir stellen später auf functions um.

Die Funktion soll auf der Admin Page aufgerufen werden können.

Hier ein Promptvorschlag:

"""
Du erzeugst eine dramaturgische Audio-Sequenz für eine interaktive Video-/Sound-Anwendung.

Die Sequenz wird von einer virtuellen Assistentin geführt.

# INPUT

Title:
{{title}}

Thema:
{{theme}}

Dauer:
{{duration}}

Persona:
{{persona}}

# AUFGABE

Erzeuge eine vollständige Sequenz als JSON.

Die Sequenz soll:

- emotional und dramaturgisch aufgebaut sein
- Spannungsbögen enthalten
- ruhigere und intensivere Phasen kombinieren
- Überraschungsmomente enthalten
- auf das Thema abgestimmt sein
- tonal zur Persona passen

Die Assistentin kommentiert die Sequenz mit kurzen direkten Aussagen.

Die Aussagen:

- sind kurz
- gut sprechbar
- maximal 1 bis 2 Sätze
- keine langen Erklärungen
- passend zur Persona
- passend zur Intensität des aktuellen Schrittes

# AUDIO REGELN

Erlaubte Werte:

- freq: 220 bis 800
- volume: 1 bis 5
- pan: -1 bis 1

Bedeutung:

- pan -1 = Fokus links
- pan 0 = Mitte
- pan 1 = Fokus rechts

Die Intensität der Sequenz soll sich insgesamt steigern, darf aber bewusst Pausen, Rücknahmen und Überraschungen enthalten.

# OUTPUT FORMAT

Gib ausschließlich valides JSON zurück.

Schema:

{
"id": "uuid",
"name": "string",
"startMessage": "string",
"endMessage": "string",
"steps": [
{
"t": number,
"dur": number,
"freq": number,
"volume": number,
"pan": number,
"mood": "neutral|soft|strict|stare|laugh|pressure",
"text": "string"
}
]
}

# WICHTIGE REGELN

- steps müssen chronologisch sein
- t ist die Startzeit in Sekunden
- dur ist die Dauer in Sekunden
- die Gesamtdauer soll ungefähr der gewünschten Dauer entsprechen
- keine zusätzlichen Felder
- keine Markdown Formatierung
- keine Kommentare
- nur JSON zurückgeben
  """
