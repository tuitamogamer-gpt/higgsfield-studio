export type MediaItem = { url: string; type: string };
export type MediaKind = "image" | "video" | "audio" | "file";

export const TERMINAL_STATUSES = ["completed", "failed", "cancelled", "canceled"];
const ACTIVE_STATUSES = ["queued", "running", "pending", "processing"];
const FAILED_STATUSES = ["failed", "canceled", "cancelled"];

export const isTerminalStatus = (status: unknown) =>
  typeof status === "string" && TERMINAL_STATUSES.includes(status);
export const isActiveStatus = (status: unknown) =>
  typeof status === "string" && ACTIVE_STATUSES.includes(status);
export const isFailedStatus = (status: unknown) =>
  typeof status === "string" && FAILED_STATUSES.includes(status);

const MEDIA_HINTS: Record<string, string> = {
  video: "video",
  videos: "video",
  image: "image",
  images: "image",
  audio: "audio",
  stems: "audio",
  archive: "application/zip",
  transcript: "text/plain",
  subtitle: "text/vtt",
  subtitles: "text/vtt",
};
const MEDIA_KEYS = new Set([
  "url",
  "download_url",
  "video",
  "videos",
  "image",
  "images",
  "audio",
  "output",
  "files",
  "content",
  "archive",
  "transcript",
  "subtitle",
  "subtitles",
  "stems",
]);

/** Collects downloadable result URLs from a provider job output, in order. */
export function mediaUrls(output: unknown): MediaItem[] {
  const found: MediaItem[] = [];
  const visit = (item: unknown, hint = "") => {
    if (!item) return;
    if (typeof item === "string") {
      if (/^https?:\/\//i.test(item) && !found.some((f) => f.url === item))
        found.push({ url: item, type: hint });
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((value) => visit(value, hint));
      return;
    }
    if (typeof item === "object") {
      const record = item as Record<string, unknown>;
      const own = (key: string) =>
        typeof record[key] === "string" ? (record[key] as string) : "";
      Object.entries(record).forEach(([key, value]) => {
        if (!MEDIA_KEYS.has(key)) return;
        visit(
          value,
          key === "url" || key === "download_url"
            ? own("content_type") || hint || own("media_type")
            : MEDIA_HINTS[key] || own("media_type") || hint,
        );
      });
    }
  };
  visit(output);
  return found;
}

export function mediaKind(item: MediaItem): MediaKind {
  if (
    /image/.test(item.type) ||
    /\.(png|jpe?g|webp|avif|gif)(\?|$)/i.test(item.url)
  )
    return "image";
  if (
    /audio/.test(item.type) ||
    /\.(mp3|wav|m4a|ogg|flac)(\?|$)/i.test(item.url)
  )
    return "audio";
  if (/video/.test(item.type) || /\.(mp4|webm|mov)(\?|$)/i.test(item.url))
    return "video";
  return "file";
}
