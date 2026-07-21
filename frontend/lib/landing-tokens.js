// Design system for the PUBLIC landing page only - deliberately separate
// from design-tokens.js (used by case-intake/donors/vet-care/login), which
// is a different, approved visual direction for the internal worker app.
// Do not merge these two token sets.

export const COLORS = {
  deepTide: "#16332B",
  seaGlass: "#E4EDE6",
  bone: "#FAF7F0",
  marigold: "#E8A33D",
  clayRose: "#C97B6D",
  charcoal: "#1F2420",
};

export const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Sora:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;

export const FONTS = {
  display: "'Fraunces', serif",
  body: "'Sora', sans-serif",
  mono: "'IBM Plex Mono', monospace",
};
