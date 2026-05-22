import { validateSequence } from "src/composables/useSoundSequences.js";

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

function extractResponseText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  const textParts = [];

  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        textParts.push(content.text);
      }

      if (content?.type === "text" && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function normalizeGeneratedSequence(sequence) {
  return {
    id:
      sequence.id ||
      (typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `generated-${Date.now()}`),
    name: sequence.name || "Generated Sequence",
    active: true,
    order: Date.now(),
    startMessage: sequence.startMessage || "",
    endMessage: sequence.endMessage || "",
    steps: (sequence.steps || []).map((step) => ({
      t: Number(step.t),
      dur: Number(step.dur),
      freq: Number(step.freq),
      volume: Number(step.volume),
      pan: Number(step.pan),
      mood: step.mood || "neutral",
      text: step.text || "",
    })),
  };
}

export async function generateSoundSequence({ title, theme, duration, persona }) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing VITE_OPENAI_API_KEY.");
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      store: false,
      instructions: `
Du erzeugst eine dramaturgische Audio-Sequenz für eine interaktive Video-/Sound-Anwendung.

Die Sequenz wird von einer virtuellen Assistentin geführt.

# INPUT

Title:
${title}

Thema:
${theme}

Dauer:
${duration}

Persona:
${persona}

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

# WICHTIGE REGELN

- steps müssen chronologisch sein
- t ist die Startzeit in Sekunden
- dur ist die Dauer in Sekunden
- die Gesamtdauer soll ungefähr der gewünschten Dauer entsprechen
- keine zusätzlichen Felder
- keine Markdown Formatierung
- keine Kommentare
- nur JSON zurückgeben
`.trim(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({ title, theme, duration, persona }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "generated_sound_sequence",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["id", "name", "startMessage", "endMessage", "steps"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              startMessage: { type: "string" },
              endMessage: { type: "string" },
              steps: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "t",
                    "dur",
                    "freq",
                    "volume",
                    "pan",
                    "mood",
                    "text",
                  ],
                  properties: {
                    t: { type: "number" },
                    dur: { type: "number" },
                    freq: { type: "number", minimum: 220, maximum: 800 },
                    volume: { type: "number", minimum: 1, maximum: 5 },
                    pan: { type: "number", minimum: -1, maximum: 1 },
                    mood: {
                      type: "string",
                      enum: ["neutral", "soft", "strict", "stare", "laugh", "pressure"],
                    },
                    text: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("OpenAI sequence generation failed", data);
    throw new Error(data?.error?.message || "Sequence generation failed.");
  }

  const raw = extractResponseText(data);
  if (!raw) {
    console.error("OpenAI sequence generation returned no text", data);
    throw new Error("Sequence generation returned no text.");
  }

  try {
    const parsed = JSON.parse(raw);
    const sequence = normalizeGeneratedSequence(parsed);
    validateSequence(sequence);
    return sequence;
  } catch (error) {
    console.error("Could not parse generated sequence", error, raw, data);
    throw new Error("Generated sequence JSON is invalid.");
  }
}
