import { useListEvents, useCreateEvent, getListEventsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CalendarDays, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, 'Required'), // Will use a datetime-local input
});

export default function AdminEvents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useListEvents();
  const create = useCreateEvent();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', description: '', location: '', startsAt: ''
    }
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    const date = new Date(values.startsAt);
    if (Number.isNaN(date.getTime())) {
      toast({ title: 'Invalid date', description: 'Choose a valid event date and time.', variant: 'destructive' });
      return;
    }
    
    create.mutate({ data: { ...values, startsAt: date.toISOString() } }, {
      onSuccess: () => {
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        toast({ description: "Event created." });
      },
      onError: () => toast({ title: 'Could not create event', description: 'Please try again.', variant: 'destructive' }),
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <header>
        <p className="text-sm font-semibold text-primary">Content management</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Manage events</h1>
        <p className="mt-2 text-muted-foreground">Schedule a gathering and keep the community informed.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Create an event</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
                <FormField control={form.control} name="startsAt" render={({ field }) => (
                  <FormItem><FormLabel>Start date & time</FormLabel><FormControl><Input type="datetime-local" {...field}/></FormControl><FormMessage/></FormItem>
                )}/>
              </div>
              <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>
              )}/>
              <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field}/></FormControl><FormMessage/></FormItem>
              )}/>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create event'}</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Scheduled events</h2>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((item) => <Card key={item} className="h-24 animate-pulse bg-muted" />)}</div>
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : 'Could not load events.'}</p>
        ) : data?.events?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {data.events.map((event) => (
              <Card key={event.id} className="rounded-2xl">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarDays className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{event.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(event.startsAt)}</p>
                    {event.location && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" aria-hidden="true" /> {event.location}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No events scheduled.</p>
        )}
      </div>
    </div>
  );
}
