import { Navigation } from './navigation';
import { useSettings } from '@/context/SettingsContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { navigationLayout } = useSettings();
  return (
    <div className={`min-h-[100dvh] bg-background flex flex-col ${navigationLayout === 'compact' ? 'md:pl-20' : 'md:pl-64'}`}>
      <Navigation />
      <main className="flex-1 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}
