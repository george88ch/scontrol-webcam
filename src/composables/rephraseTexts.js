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

export async function rephraseTexts({ persona, texts }) {
  if (!OPENAI_API_KEY) {
    console.warn("Missing VITE_OPENAI_API_KEY");
    return texts;
  }

  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
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
Du rephrasest kurze deutsche Texte für eine Bildschirm- und Soundsequenz.

Persona:
${persona}

Regeln:
- Gib exakt gleich viele Texte zurück.
- Gleiche Reihenfolge.
- Kurz, prägnant, sprechbar.
- Bedeutung beibehalten.
- Keine Erklärungen.
- Keine Nummerierung.
`.trim(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({ texts }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "rephrased_texts",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["texts"],
            properties: {
              texts: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("OpenAI rephrase failed", data);
    return texts;
  }

  const raw = extractResponseText(data);

  if (!raw) {
    console.error("OpenAI rephrase returned no text", data);
    return texts;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.texts)) return texts;
    if (parsed.texts.length !== texts.length) return texts;

    return parsed.texts;
  } catch (e) {
    console.error("Could not parse rephrase result", e, raw, data);
    return texts;
  }
}

export async function rephraseSequence(sequence, persona) {
  const steps = sequence.steps || [];

  const originalTexts = [
    sequence.startMessage || "",
    ...steps.map((step) => step.text || ""),
    sequence.endMessage || "",
  ];

  const rephrased = await rephraseTexts({
    persona,
    texts: originalTexts,
  });

  return {
    ...sequence,

    startMessage: rephrased[0] || sequence.startMessage,

    steps: steps.map((step, index) => ({
      ...step,
      text: rephrased[index + 1] || step.text,
    })),

    endMessage: rephrased[rephrased.length - 1] || sequence.endMessage,
  };
}
