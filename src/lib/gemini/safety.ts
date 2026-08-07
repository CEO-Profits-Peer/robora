import { isGeminiConfigured, blobToBase64, generateContent } from "./client";

export type SafetyResult = { safe: true } | { safe: false; reason: string };

const SAFETY_PROMPT = `Du prüfst eine Sprachaufnahme aus einer Latein-Lern-App, bevor sie öffentlich für andere Nutzer geteilt wird.
Höre dir die Aufnahme an. Sie sollte Latein- oder Deutsch-Lerninhalt sein (Vokabeln, Grammatik, Übersetzungen).
Melde NUR ein Problem, wenn die Aufnahme eindeutig missbräuchlich ist: Beleidigungen, Hassrede, sexuelle Inhalte, Gewaltverherrlichung, oder komplett irrelevanter/leerer Inhalt (z.B. Stille, Musik, Zufallsgeräusche ohne jeden Lernbezug).
Sei tolerant bei allem, was nach Lerninhalt aussieht, auch wenn Latein-Aussprache/Grammatik fehlerhaft ist.
Antworte AUSSCHLIESSLICH mit validem JSON: {"safe": true} oder {"safe": false, "reason": "kurze Begründung auf Deutsch"}. Kein Markdown.`;

// Quick, best-effort check — fails open (safe: true) on any error so a Gemini
// outage or quota issue never blocks the user from publishing their own recording.
export async function checkAudioSafety(audioUrl: string): Promise<SafetyResult> {
  if (!isGeminiConfigured) return { safe: true };

  try {
    const audioRes = await fetch(audioUrl);
    const blob = await audioRes.blob();
    if (blob.size > 15 * 1024 * 1024) return { safe: true };

    const base64 = await blobToBase64(blob);
    const text = await generateContent(
      [{ text: SAFETY_PROMPT }, { inline_data: { mime_type: blob.type || "audio/webm", data: base64 } }],
      { temperature: 0, jsonResponse: true }
    );

    const parsed = JSON.parse(text);
    if (parsed?.safe === false && typeof parsed.reason === "string") {
      return { safe: false, reason: parsed.reason };
    }
    return { safe: true };
  } catch {
    return { safe: true };
  }
}
