export const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim() ||
  "ca-pub-2090516545725907";

export const ADSENSE_SLOTS = {
  services:
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_SERVICES?.trim() ||
    "3519556102",
  vendors:
    process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_SLOT_VENDORS?.trim() ||
    "6592623182",
} as const;
