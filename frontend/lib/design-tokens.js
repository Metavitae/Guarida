// Guarida design system — one source of truth.
// Every screen imports from here instead of redefining COLORS locally,
// which is what the first four mockups did (fine for fast iteration,
// wrong for an actual app where the palette needs to change in one place).

export const COLORS = {
  night: "#10262E",
  nightDeep: "#0A1B21",
  teal: "#1F5C6B",
  coral: "#E8577A",
  marigold: "#E8B95C",
  paper: "#F3EDE0",
  ink: "#1C2B2E",
  line: "#E4DCC9",
  green: "#7A9E7E",
};

export const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;

export const FONTS = {
  display: "'Fraunces', serif",
  body: "'Inter', sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

// Shared input styling — was retyped in every field on the Case Intake
// screen; centralizing it means changing the input look once, everywhere.
export const inputStyle = {
  backgroundColor: "#FFFFFF",
  border: `1.5px solid ${COLORS.line}`,
  color: COLORS.ink,
  fontFamily: FONTS.body,
};
