export const isTtsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

function speak(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => {
    if (!text.trim()) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ReadOrder = "latin-first" | "german-first";

export async function readCard(
  card: { latin: string; german: string; note?: string | null },
  order: ReadOrder
) {
  if (!isTtsSupported) return;
  window.speechSynthesis.cancel();

  const latinPart = async () => {
    await speak(card.latin, "la");
    if (card.note) await speak(card.note, "la");
  };
  const germanPart = () => speak(card.german, "de-DE");

  if (order === "latin-first") {
    await latinPart();
    await pause(1000);
    await germanPart();
  } else {
    await germanPart();
    await pause(1000);
    await latinPart();
  }
}
