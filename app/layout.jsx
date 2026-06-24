export const metadata = {
  title: "Family Karaoke",
  description: "Tap a singer, log a song they crush, and get fresh AI picks for the queue.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
