import { useAuth } from '@/context/AuthContext';
import { useDevotionalStreak } from '@/hooks/use-streak';
import { useListDevotionals, useListEvents } from '@workspace/api-client-react';
import { Link } from 'wouter';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Flame,
  Heart,
  MapPin,
  MessageCircle,
  Music2,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

const quickLinks = [
  { href: '/prayer', label: 'Prayer room', description: 'Share a request', icon: Heart },
  { href: '/community', label: 'Community', description: 'Chat or ask a mentor', icon: MessageCircle },
  { href: '/music', label: 'Worship music', description: 'Listen and reflect', icon: Music2 },
  { href: '/reading-plans', label: 'Study guides', description: 'Grow in the Word', icon: BookOpen },
  { href: '/events', label: 'Youth events', description: 'Find your next gathering', icon: CalendarDays },
];

export default function Home() {
  const { user } = useAuth();
  const { streak } = useDevotionalStreak(user?.id);
  const { data: devotionsData } = useListDevotionals();
  const { data: eventsData } = useListEvents();

  const todayDevotional = devotionsData?.devotionals?.[0];
  const upcomingEvents = eventsData?.events
    ?.filter((event) => new Date(event.startsAt) >= new Date())
    .slice(0, 2);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 md:space-y-10 md:px-8 md:py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">
            {new Intl.DateTimeFormat('en-ZW', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {user?.firstName || 'friend'}.
          </h1>
          <p className="mt-2 text-muted-foreground">A little space to grow, connect, and find encouragement.</p>
        </div>
        <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3 sm:flex">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary/20">
            <Flame className="size-5 text-secondary" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-lg font-bold leading-tight">{streak} days</span>
            <span className="text-xs text-muted-foreground">Your reading streak</span>
          </span>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
        <Link
          href="/devotion"
          className="group relative flex min-h-[19rem] flex-col justify-between overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-8"
        >
          <div className="pointer-events-none absolute -right-10 -top-20 size-64 rounded-full border-[36px] border-primary-foreground/5" />
          <div className="pointer-events-none absolute -bottom-28 right-24 size-64 rounded-full border-[1px] border-secondary/30" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Today&apos;s word
            </span>
            <h2 className="mt-6 max-w-xl font-serif text-3xl leading-tight sm:text-4xl">
              {todayDevotional?.title || 'Take a moment to reconnect.'}
            </h2>
            {todayDevotional && (
              <>
                <p className="mt-3 font-medium text-secondary">{todayDevotional.scriptureRef}</p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/80 line-clamp-3">
                  {todayDevotional.body}
                </p>
              </>
            )}
          </div>
          <span className="relative mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors group-hover:bg-secondary/90">
            Read today&apos;s devotion
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </span>
        </Link>

        <Card className="rounded-3xl border-border/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Make a plan</p>
              <CardTitle className="mt-1 text-xl">Coming up</CardTitle>
            </div>
            <Link href="/events" aria-label="See all events" className="rounded-full p-2 text-primary hover:bg-muted">
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents?.length ? upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href="/events"
                className="block rounded-2xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <p className="font-semibold leading-snug">{event.title}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {formatDate(event.startsAt)}
                  </span>
                  {event.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {event.location}
                    </span>
                  )}
                </div>
              </Link>
            )) : (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-5 text-center">
                <CalendarDays className="mb-3 size-8 text-muted-foreground/60" aria-hidden="true" />
                <p className="font-medium">Nothing on the calendar just yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Check back for the next youth gathering.</p>
              </div>
            )}
            <Link href="/events" className="inline-flex items-center gap-2 px-1 pt-1 text-sm font-semibold text-primary hover:underline">
              Explore all events <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="quick-links-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Your community</p>
            <h2 id="quick-links-heading" className="mt-1 text-2xl font-semibold tracking-tight">Where would you like to go?</h2>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <Flame className="size-4 text-secondary" aria-hidden="true" />
            <span>{streak} day reading streak</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {quickLinks.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
            >
              <span className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="block font-semibold">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
