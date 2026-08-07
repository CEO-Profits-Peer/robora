const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = "gemini-2.5-flash-lite";

export const isGeminiConfigured = Boolean(API_KEY);

export type ExtractedCard = { latin: string; german: string; note?: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PROMPT = `Du bekommst ein Foto von handschriftlichen oder gedruckten Lateinnotizen (Vokabelliste, Deklinations- oder Konjugationstabelle, oder Grammatikregeln).
Extrahiere daraus Latein-Lernkarten. Für Vokabeln: Latein-Begriff + deutsche Übersetzung. Für Grammatiktabellen (z.B. Deklinationen): erzeuge eine Karte pro Formen-Zeile, z.B. Latein "rosa (Nom. Sg.)" -> Deutsch "die Rose".
Antworte AUSSCHLIESSLICH mit validem JSON, einem Array von Objekten der Form {"latin": "...", "german": "...", "note": "optionaler Kontext, z.B. Deklinationsklasse oder Grammatikhinweis"}. Kein Markdown, kein Fließtext, keine Codeblock-Markierung.`;

export async function extractCardsFromImage(file: File): Promise<ExtractedCard[]> {
  if (!API_KEY) throw new Error("Kein Gemini API-Key konfiguriert (VITE_GEMINI_API_KEY).");

  const base64 = await fileToBase64(file);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: file.type || "image/jpeg", data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini-Anfrage fehlgeschlagen (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Keine Antwort von Gemini erhalten.");

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Unerwartetes Antwortformat von Gemini.");
  return parsed.filter((c) => c && typeof c.latin === "string" && typeof c.german === "string");
}

const SAFETY_PROMPT = `Du prüfst eine Sprachaufnahme aus einer Latein-Lern-App, bevor sie öffentlich für andere Nutzer geteilt wird.
Höre dir die Aufnahme an. Sie sollte Latein- oder Deutsch-Lerninhalt sein (Vokabeln, Grammatik, Übersetzungen).
Melde NUR ein Problem, wenn die Aufnahme eindeutig missbräuchlich ist: Beleidigungen, Hassrede, sexuelle Inhalte, Gewaltverherrlichung, oder komplett irrelevanter/leerer Inhalt (z.B. Stille, Musik, Zufallsgeräusche ohne jeden Lernbezug).
Sei tolerant bei allem, was nach Lerninhalt aussieht, auch wenn Latein-Aussprache/Grammatik fehlerhaft ist.
Antworte AUSSCHLIESSLICH mit validem JSON: {"safe": true} oder {"safe": false, "reason": "kurze Begründung auf Deutsch"}. Kein Markdown.`;

export type SafetyResult = { safe: true } | { safe: false; reason: string };

export async function checkAudioSafety(audioUrl: string): Promise<SafetyResult> {
  if (!API_KEY) return { safe: true };

  const audioRes = await fetch(audioUrl);
  const blob = await audioRes.blob();
  if (blob.size > 15 * 1024 * 1024) return { safe: true };

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SAFETY_PROMPT },
              { inline_data: { mime_type: blob.type || "audio/webm", data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) return { safe: true };

  try {
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text);
    if (parsed?.safe === false && typeof parsed.reason === "string") {
      return { safe: false, reason: parsed.reason };
    }
    return { safe: true };
  } catch {
    return { safe: true };
  }
}
