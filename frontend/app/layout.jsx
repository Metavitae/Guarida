import "./globals.css";

export const metadata = {
  title: "Guarida",
  description: "Every case, every foster home, every donor — held in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
