import { blobToBase64, generateContent } from "./client";

export type ExtractedCard = { latin: string; german: string; note?: string };

const PROMPT = `Du bekommst ein Foto von handschriftlichen oder gedruckten Lateinnotizen (Vokabelliste, Deklinations- oder Konjugationstabelle, oder Grammatikregeln).
Extrahiere daraus Latein-Lernkarten. Für Vokabeln: Latein-Begriff + deutsche Übersetzung. Für Grammatiktabellen (z.B. Deklinationen): erzeuge eine Karte pro Formen-Zeile, z.B. Latein "rosa (Nom. Sg.)" -> Deutsch "die Rose".
Antworte AUSSCHLIESSLICH mit validem JSON, einem Array von Objekten der Form {"latin": "...", "german": "...", "note": "optionaler Kontext, z.B. Deklinationsklasse oder Grammatikhinweis"}. Kein Markdown, kein Fließtext, keine Codeblock-Markierung.`;

export async function extractCardsFromImage(file: File): Promise<ExtractedCard[]> {
  const base64 = await blobToBase64(file);
  const text = await generateContent(
    [{ text: PROMPT }, { inline_data: { mime_type: file.type || "image/jpeg", data: base64 } }],
    { temperature: 0.2, jsonResponse: true }
  );

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Unerwartetes Antwortformat von Gemini.");
  return parsed.filter((c) => c && typeof c.latin === "string" && typeof c.german === "string");
}
