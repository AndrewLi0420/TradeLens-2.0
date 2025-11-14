import type { ReactNode } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Main layout wrapper component
 * Includes Header and main content area
 * Responsive flex/grid layout with Tailwind CSS
 */
export default function Layout({ children, className = '' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header />
      <main className={`flex-1 p-4 md:p-6 lg:p-8 ${className}`}>
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

