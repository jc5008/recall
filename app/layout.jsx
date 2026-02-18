import "./globals.css";

export const metadata = {
  title: "Recall | Mastery Training",
  description: "Forced recall flashcard trainer with adaptive missed-item loops.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
