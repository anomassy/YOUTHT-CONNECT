import { Navigation } from './navigation';
import { useSettings } from '@/context/SettingsContext';
import { useListDevotionals } from '@workspace/api-client-react';
import { BookOpen, Share2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function Layout({ children }: { children: React.ReactNode }) {
  const { navigationLayout } = useSettings();
  return (
    <div className={`min-h-[100dvh] bg-background flex flex-col ${navigationLayout === 'compact' ? 'md:pl-20' : 'md:pl-64'}`}>
      <Navigation />
      <main className="flex-1 pb-36 md:pb-24">
        {children}
      </main>
      <DailyReadingBar compact={navigationLayout === 'compact'} />
    </div>
  );
}

function DailyReadingBar({ compact }: { compact: boolean }) {
  const { data } = useListDevotionals();
  const { toast } = useToast();
  const devotional = data?.devotionals?.[0];

  if (!devotional) return null;

  const shareDevotional = async () => {
    const text = `${devotional.scriptureText}\n${devotional.scriptureRef}`;
    const url = new URL('/devotion', window.location.href).href;
    try {
      if (navigator.share) {
        await navigator.share({ title: devotional.title, text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast({ description: "Today's verse copied to your clipboard." });
      } else {
        toast({
          title: 'Sharing is unavailable',
          description: 'Your browser does not support sharing or clipboard access.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast({
        title: "Could not share today's verse",
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <aside
      aria-label="Daily verse"
      className={`fixed bottom-[4.75rem] left-3 right-3 z-30 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur md:bottom-4 md:right-6 ${
        compact ? 'md:left-24' : 'md:left-[17rem]'
      }`}
    >
      <Link href="/devotion" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpen className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Today&apos;s verse</span>
          <span className="block truncate text-sm font-semibold">{devotional.scriptureRef}</span>
        </span>
      </Link>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="shrink-0 gap-2 rounded-full"
        onClick={() => void shareDevotional()}
        aria-label="Share today's verse"
      >
        <Share2 className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Share</span>
      </Button>
    </aside>
  );
}
