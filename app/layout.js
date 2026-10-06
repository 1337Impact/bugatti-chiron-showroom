import './globals.css';

const title = 'Chiron — Virtual Showroom';
const description =
  'An open-source, real-time Bugatti Chiron configurator that runs in the browser: paint, finish, brakes, wheels, lights, livery, rear wing, three environments and photo capture. Built with Next.js and three.js.';

export const metadata = {
  metadataBase: new URL('https://bugatti-chiron-showroom.vercel.app'),
  title,
  description,
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#040405',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
