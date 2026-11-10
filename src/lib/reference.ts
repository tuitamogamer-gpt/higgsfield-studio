export type ReferenceKind = "image" | "video" | "audio" | "file";

export const SUPPORTED_REFERENCE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
];
const SUPPORTED = new Set(SUPPORTED_REFERENCE_TYPES);
const EXTENSION_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
};
const ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "audio/x-m4a": "audio/mp4",
  "audio/x-aac": "audio/aac",
  "audio/vnd.wave": "audio/wav",
};
const FORMAT_NAMES: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "image/gif": "GIF",
  "video/mp4": "MP4",
  "video/webm": "WEBM",
  "video/quicktime": "MOV",
  "audio/mpeg": "MP3",
  "audio/mp3": "MP3",
  "audio/wav": "WAV",
  "audio/x-wav": "WAV",
  "audio/mp4": "M4A",
  "audio/aac": "AAC",
  "audio/ogg": "OGG",
  "audio/webm": "WEBM",
};

/** Matches the server's direct-upload limits. */
export const referenceLimitMb = (type: string) =>
  type.startsWith("video/") ? 50 : 20;

export function acceptTokens(accept: string) {
  return accept
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function acceptsType(type: string, filename: string, tokens: string[]) {
  if (!tokens.length || tokens.includes("*/*")) return true;
  return tokens.some((token) =>
    token.startsWith(".")
      ? filename.toLowerCase().endsWith(token)
      : token.endsWith("/*")
        ? type.startsWith(token.slice(0, -1))
        : type === (ALIASES[token] || token),
  );
}

export function referenceRules(accept: string) {
  const tokens = acceptTokens(accept);
  const available = SUPPORTED_REFERENCE_TYPES.filter((type) =>
    acceptsType(
      type,
      `file.${Object.keys(EXTENSION_TYPES).find((ext) => EXTENSION_TYPES[ext] === type) || ""}`,
      tokens,
    ),
  );
  const families = [...new Set(available.map((type) => type.split("/")[0]))];
  const kind = (families.length === 1 ? families[0] : "file") as ReferenceKind;
  const formats = [...new Set(available.map((type) => FORMAT_NAMES[type]))].join(", ");
  const limitLabel =
    kind === "video"
      ? "Do 50 MB"
      : kind === "image" || kind === "audio"
        ? "Do 20 MB"
        : "Slike/audio do 20 MB · video do 50 MB";
  const fileLabel =
    kind === "image"
      ? "sliku"
      : kind === "video"
        ? "video"
        : kind === "audio"
          ? "audio"
          : "datoteku";
  return { tokens, available, kind, formats, limitLabel, fileLabel };
}

/** Infers a reliable MIME type and checks format and size before uploading. */
export function prepareReferenceFile(
  original: File,
  accept: string,
): { file: File; error?: undefined } | { error: string; file?: undefined } {
  const { tokens, fileLabel } = referenceRules(accept);
  const extension = original.name.split(".").pop()?.toLowerCase() || "";
  const reported = original.type.toLowerCase();
  const type =
    ALIASES[reported] ||
    (!reported || reported === "application/octet-stream"
      ? EXTENSION_TYPES[extension] || ""
      : reported);
  if (!SUPPORTED.has(type))
    return {
      error:
        "Ovaj format nije podržan. Odaberi datoteku u jednom od navedenih formata.",
    };
  if (!acceptsType(type, original.name, tokens))
    return { error: `Za ovo polje odaberi ${fileLabel} u podržanom formatu.` };
  if (!original.size)
    return { error: "Datoteka je prazna. Odaberi drugu datoteku." };
  const limitMb = referenceLimitMb(type);
  if (original.size > limitMb * 1024 * 1024)
    return {
      error: `Datoteka je prevelika. Najveća dopuštena veličina je ${limitMb} MB.`,
    };
  return {
    file:
      type === original.type
        ? original
        : new File([original], original.name || "referenca", {
            type,
            lastModified: original.lastModified,
          }),
  };
}
