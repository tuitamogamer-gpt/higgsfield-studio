/** Formats provider micro-USD amounts without rounding small prices to zero. */
export function formatUsd(microUsd: number): string {
  if (!Number.isFinite(microUsd)) return "";
  const usd = Math.max(0, microUsd) / 1_000_000;
  if (usd === 0) return "$0";
  if (usd >= 1) return `$${usd.toFixed(2).replace(/\.00$/, "")}`;
  const digits = usd >= 0.01 ? 4 : 6;
  // Keep at least cents, then trim trailing zeros: 0.2 → 0.20, 0.0980 → 0.098.
  return `$${usd.toFixed(digits).replace(/(\.\d{2}\d*?)0+$/, "$1")}`;
}

type PriceUnit = { type?: unknown; quantity?: unknown };
type PriceComponent = {
  role?: unknown;
  unit?: PriceUnit;
  starting_at?: { micro_usd?: unknown };
};
export type StartingPrice = {
  amount: string;
  unit: string;
  label: string;
  microUsd: number;
  /** True when the model also bills other components, e.g. input tokens. */
  partial: boolean;
};

// [singular, plural after a number]
const UNIT_LABELS: Record<string, [string, string]> = {
  second: ["s", "s"],
  output_second: ["s", "s"],
  output_audio_second: ["s zvuka", "s zvuka"],
  video_input_second: ["s ulaznog videa", "s ulaznog videa"],
  minute: ["min", "min"],
  image: ["slika", "slika"],
  output_image_1k: ["slika 1K", "slika 1K"],
  output_image_2k: ["slika 2K", "slika 2K"],
  input_image: ["ulazna slika", "ulaznih slika"],
  request: ["zahtjev", "zahtjeva"],
  character: ["znak", "znakova"],
  output_megapixel: ["MP", "MP"],
  output_frame_1080p: ["sličica 1080p", "sličica 1080p"],
  output_frame_4k: ["sličica 4K", "sličica 4K"],
};

export function priceUnitLabel(unit: PriceUnit | undefined): string | null {
  const type = typeof unit?.type === "string" ? unit.type.trim() : "";
  if (!type || type.length > 60) return null;
  const quantity =
    typeof unit?.quantity === "number" &&
    Number.isSafeInteger(unit.quantity) &&
    unit.quantity > 1
      ? unit.quantity
      : 1;
  const [singular, plural] = /token$/.test(type)
    ? ["token", "tokena"]
    : UNIT_LABELS[type] || [type.replaceAll("_", " "), type.replaceAll("_", " ")];
  if (quantity === 1) return singular;
  const amount =
    quantity % 1_000_000 === 0 ? `${quantity / 1_000_000}M` : String(quantity);
  return `${amount} ${plural}`;
}

/** The lowest catalog price of a model's main billed unit, if published. */
export function startingPrice(pricing: unknown): StartingPrice | null {
  const components =
    pricing && typeof pricing === "object"
      ? (pricing as { components?: unknown }).components
      : undefined;
  if (!Array.isArray(components)) return null;
  const valid = components.filter((component: PriceComponent) => {
    const micro = component?.starting_at?.micro_usd;
    return (
      typeof micro === "number" &&
      Number.isSafeInteger(micro) &&
      micro >= 0 &&
      priceUnitLabel(component.unit) !== null
    );
  }) as PriceComponent[];
  const primary = valid.find((component) => component.role === "output") || valid[0];
  if (!primary) return null;
  const microUsd = primary.starting_at!.micro_usd as number;
  const amount = formatUsd(microUsd);
  const unit = priceUnitLabel(primary.unit)!;
  return {
    amount,
    unit,
    label: `od ${amount} / ${unit}`,
    microUsd,
    partial: valid.length > 1,
  };
}

/** Spendable amount, matching the server's prepaid/postpaid balance check. */
export function availableBalanceMicro(balance: unknown): number | null {
  if (!balance || typeof balance !== "object") return null;
  const value = balance as {
    balance_micro_usd?: unknown;
    postpaid?: { active?: unknown; cycle?: { remaining_micro_usd?: unknown } } | null;
  };
  const amount = value.postpaid?.active
    ? value.postpaid.cycle?.remaining_micro_usd
    : value.balance_micro_usd;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

export function isPostpaidBalance(balance: unknown): boolean {
  return !!(
    balance &&
    typeof balance === "object" &&
    (balance as { postpaid?: { active?: unknown } | null }).postpaid?.active
  );
}
