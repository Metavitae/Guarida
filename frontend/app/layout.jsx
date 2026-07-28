import "./globals.css";
import { ThemeProvider } from "../lib/theme-context";

export const metadata = {
  title: "Guarida",
  description: "Every case, every foster home, every donor — held in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
