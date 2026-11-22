import { useMemo, useState } from 'react';
import { useListEvents, useToggleRsvp, getListEventsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CheckCircle2, Clock3, MapPin, Search, Users } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type EventFilter = 'upcoming' | 'past' | 'all';

export default function Events() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useListEvents();
  const toggleRsvp = useToggleRsvp();
  const [filter, setFilter] = useState<EventFilter>('upcoming');
  const [search, setSearch] = useState('');
  const events = data?.events ?? [];
  const now = Date.now();

  const visibleEvents = useMemo(() => events.filter((event) => {
    const isPast = new Date(event.startsAt).getTime() < now;
    const matchesFilter = filter === 'all' || (filter === 'past' ? isPast : !isPast);
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query
      || event.title.toLocaleLowerCase().includes(query)
      || event.location?.toLocaleLowerCase().includes(query)
      || event.description?.toLocaleLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }), [events, filter, now, search]);

  const handleRsvp = (id: number) => {
    toggleRsvp.mutate(
      { id },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
          toast({ description: result.isRsvped ? 'You are on the list.' : 'Your RSVP was cancelled.' });
        },
        onError: () => toast({
          title: 'Could not update your RSVP',
          description: 'Please try again.',
          variant: 'destructive',
        }),
      },
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Find your people</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Youth events</h1>
          <p className="mt-2 text-muted-foreground">Gather, worship, and grow together.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events"
            aria-label="Search events"
            className="pl-9"
          />
        </div>
      </header>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as EventFilter)}>
        <TabsList className="grid h-auto w-full max-w-sm grid-cols-3 rounded-xl p-1">
          <TabsTrigger value="upcoming" className="rounded-lg py-2">Upcoming</TabsTrigger>
          <TabsTrigger value="past" className="rounded-lg py-2">Past</TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg py-2">All events</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading events">
          {[0, 1, 2].map((item) => <Card key={item} className="h-64 animate-pulse bg-muted" />)}
        </div>
      ) : isError ? (
        <Card><CardContent className="p-6 text-sm text-destructive" role="alert">
          {error instanceof Error ? error.message : 'Could not load events. Please try again.'}
        </CardContent></Card>
      ) : visibleEvents.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleEvents.map((event) => {
            const date = new Date(event.startsAt);
            const isPast = date.getTime() < now;
            return (
              <Card key={event.id} className={cn('flex flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-md', isPast && 'opacity-80')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4">
                    <div className="flex min-w-14 flex-col items-center rounded-xl bg-primary/10 px-2.5 py-2 text-primary">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {date.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="text-2xl font-bold leading-tight">{date.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {isPast ? 'Past gathering' : 'Youth gathering'}
                      </p>
                      <CardTitle className="mt-1 text-lg leading-snug">{event.title}</CardTitle>
                    </div>
                    {event.isRsvped && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" /> Going
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="size-4 shrink-0 text-primary/70" aria-hidden="true" />
                    <span>{formatDate(event.startsAt)} · {date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4 shrink-0 text-primary/70" aria-hidden="true" />
                      <span>{event.location}</span>
                    </div>
                  )}
                  {event.description && <p className="line-clamp-3 text-sm leading-6">{event.description}</p>}
                </CardContent>
                <CardFooter className="border-t bg-muted/10 pt-4">
                  <Button
                    type="button"
                    className="w-full gap-2"
                    variant={event.isRsvped ? 'secondary' : 'default'}
                    disabled={isPast || toggleRsvp.isPending}
                    onClick={() => handleRsvp(event.id)}
                  >
                    {isPast ? <CalendarDays className="size-4" aria-hidden="true" /> : <Users className="size-4" aria-hidden="true" />}
                    {isPast ? 'Event ended' : event.isRsvped ? 'Cancel RSVP' : 'RSVP'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center p-10 text-center">
            <CalendarDays className="size-9 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-semibold">{search ? 'No matching events' : filter === 'past' ? 'No past events to show' : 'No events scheduled yet'}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {search ? 'Try another search term.' : filter === 'upcoming' ? 'Check back soon for the next gathering.' : 'When events are added, they will appear here.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
