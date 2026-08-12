const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = "gemini-flash-lite-latest";

export const isGeminiConfigured = Boolean(API_KEY);

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateContent(parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }>, opts: {
  temperature: number;
  jsonResponse?: boolean;
}) {
  if (!API_KEY) throw new Error("Kein Gemini API-Key konfiguriert (VITE_GEMINI_API_KEY).");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: opts.temperature,
        ...(opts.jsonResponse ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini-Anfrage fehlgeschlagen (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Keine Antwort von Gemini erhalten.");
  return text as string;
}
