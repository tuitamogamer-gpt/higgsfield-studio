// Croatian names for catalog operation types; unknown ones stay readable.
const FUNCTION_LABELS: Record<string, string> = {
  "text-to-video": "Tekst → video",
  "image-to-video": "Slika → video",
  "reference-to-video": "Referenca → video",
  "video-to-video": "Video → video",
  "draft-to-video": "Skica → video",
  "omni-video": "Svestrani video",
  "video-extension": "Produljenje videa",
  "video-upscale": "Povećanje videa",
  "motion-control": "Kontrola pokreta",
  "merge-videos": "Spajanje videa",
  "compose-video": "Montaža videa",
  "caption-video": "Titlovi za video",
  avatar: "Avatar",
  "text-to-image": "Tekst → slika",
  "image-to-image": "Slika → slika",
  "image-upscale": "Povećanje slike",
  "layer-decomposition": "Rastavljanje na slojeve",
  "text-to-audio": "Tekst → audio",
  "text-to-speech": "Tekst → govor",
  "speech-to-text": "Govor → tekst",
  "speech-to-speech": "Govor → govor",
  "text-to-music": "Tekst → glazba",
  "video-to-music": "Video → glazba",
  "video-to-audio": "Video → audio",
  "video-to-sound-effects": "Video → zvučni efekti",
  "video-to-scored-video": "Video s glazbom",
  "sound-effects": "Zvučni efekti",
  "audio-stems": "Razdvajanje zvuka",
  "voice-isolation": "Izolacija glasa",
  dubbing: "Sinkronizacija",
  transcription: "Transkripcija",
  "pika-music": "Glazba",
  "pika-sfx": "Zvučni efekti",
  "pika-speech": "Govor",
  "pika-soundtrack": "Glazbena podloga",
};

export function functionLabel(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const label = FUNCTION_LABELS[value];
  if (label) return label;
  const words = value.replaceAll("-", " ").replaceAll("_", " ").trim();
  return words.charAt(0).toLocaleUpperCase("hr") + words.slice(1);
}

const CATEGORY_LABELS: Record<string, string> = {
  video: "Video",
  image: "Slike",
  audio: "Audio",
};

export function categoryLabel(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Ostalo";
  return (
    CATEGORY_LABELS[value] ||
    value.charAt(0).toLocaleUpperCase("hr") + value.slice(1)
  );
}
