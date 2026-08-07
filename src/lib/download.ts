export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function safeFilename(title: string, ext: string) {
  const base = title.trim().replace(/[^\p{L}\p{N}\-_ ]/gu, "").replace(/\s+/g, "-") || "aufnahme";
  return `${base}.${ext}`;
}
