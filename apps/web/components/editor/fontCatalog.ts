export type FontEntry = {
  id: string;
  displayName: string;
  cssFamily: string;
  category: "sans-serif" | "serif" | "monospace" | "display" | "handwriting";
};

const CURATED_FONTS: FontEntry[] = [
  { id: "inter", displayName: "Inter", cssFamily: "Inter", category: "sans-serif" },
  { id: "roboto", displayName: "Roboto", cssFamily: "Roboto", category: "sans-serif" },
  { id: "open-sans", displayName: "Open Sans", cssFamily: "Open Sans", category: "sans-serif" },
  { id: "lato", displayName: "Lato", cssFamily: "Lato", category: "sans-serif" },
  { id: "montserrat", displayName: "Montserrat", cssFamily: "Montserrat", category: "sans-serif" },
  { id: "source-sans-3", displayName: "Source Sans 3", cssFamily: "Source Sans 3", category: "sans-serif" },
  { id: "noto-sans", displayName: "Noto Sans", cssFamily: "Noto Sans", category: "sans-serif" },
  { id: "ibm-plex-sans", displayName: "IBM Plex Sans", cssFamily: "IBM Plex Sans", category: "sans-serif" },
  { id: "fira-sans", displayName: "Fira Sans", cssFamily: "Fira Sans", category: "sans-serif" },
  { id: "space-grotesk", displayName: "Space Grotesk", cssFamily: "Space Grotesk", category: "sans-serif" },
  { id: "manrope", displayName: "Manrope", cssFamily: "Manrope", category: "sans-serif" },
  { id: "plus-jakarta-sans", displayName: "Plus Jakarta Sans", cssFamily: "Plus Jakarta Sans", category: "sans-serif" },
  { id: "work-sans", displayName: "Work Sans", cssFamily: "Work Sans", category: "sans-serif" },
  { id: "nunito-sans", displayName: "Nunito Sans", cssFamily: "Nunito Sans", category: "sans-serif" },
  { id: "dm-sans", displayName: "DM Sans", cssFamily: "DM Sans", category: "sans-serif" },
  { id: "rubik", displayName: "Rubik", cssFamily: "Rubik", category: "sans-serif" },
  { id: "archivo", displayName: "Archivo", cssFamily: "Archivo", category: "sans-serif" },
  { id: "oswald", displayName: "Oswald", cssFamily: "Oswald", category: "sans-serif" },
  { id: "bebas-neue", displayName: "Bebas Neue", cssFamily: "Bebas Neue", category: "sans-serif" },
  { id: "noto-serif", displayName: "Noto Serif", cssFamily: "Noto Serif", category: "serif" },
  { id: "merriweather", displayName: "Merriweather", cssFamily: "Merriweather", category: "serif" },
  { id: "playfair-display", displayName: "Playfair Display", cssFamily: "Playfair Display", category: "serif" },
  { id: "libre-baskerville", displayName: "Libre Baskerville", cssFamily: "Libre Baskerville", category: "serif" },
  { id: "eb-garamond", displayName: "EB Garamond", cssFamily: "EB Garamond", category: "serif" },
  { id: "source-serif-4", displayName: "Source Serif 4", cssFamily: "Source Serif 4", category: "serif" },
  { id: "ibm-plex-serif", displayName: "IBM Plex Serif", cssFamily: "IBM Plex Serif", category: "serif" },
  { id: "cormorant-garamond", displayName: "Cormorant Garamond", cssFamily: "Cormorant Garamond", category: "serif" },
  { id: "crimson-text", displayName: "Crimson Text", cssFamily: "Crimson Text", category: "serif" },
  { id: "jetbrains-mono", displayName: "JetBrains Mono", cssFamily: "JetBrains Mono", category: "monospace" },
  { id: "fira-code", displayName: "Fira Code", cssFamily: "Fira Code", category: "monospace" },
  { id: "space-mono", displayName: "Space Mono", cssFamily: "Space Mono", category: "monospace" },
];

export function getCatalogFonts(): FontEntry[] {
  return CURATED_FONTS;
}

export function getFontById(id: string): FontEntry | undefined {
  return CURATED_FONTS.find((f) => f.id === id);
}

export function getFontsByCategory(category: FontEntry["category"]): FontEntry[] {
  return CURATED_FONTS.filter((f) => f.category === category);
}
