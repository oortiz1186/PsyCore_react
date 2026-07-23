import type { Metadata } from 'next';
import './globals.css';
import './design-system.css';
import './patients.css';

export const metadata: Metadata = {
  title: 'PsyCore',
  description: 'Gestión psicológica profesional',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
