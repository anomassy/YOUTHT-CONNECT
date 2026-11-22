import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetReadingProgressQueryKey,
  useCompleteReadingDay,
  useGetReadingProgress,
  useListReadingPlans,
} from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type QuarterlyDay = {
  id: number;
  day: number;
  title: string;
  scriptureRef: string;
  content: string;
};

type QuarterlyLesson = {
  week: number;
  title: string;
  dateRange: string;
  page: number | null;
  days?: QuarterlyDay[];
};

type Quarterly = {
  id?: number;
  title: string;
  publication: string;
  quarter: string;
  summary: string;
  lessons: QuarterlyLesson[];
};

type QuarterlyChoice = {
  id: number;
  title: string;
  quarter: string;
  isCurrent: boolean;
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Sabbath'];

export default function ReadingPlans() {
  const { token, getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEditionId, setSelectedEditionId] = useState('');
  const [quarterly, setQuarterly] = useState<Quarterly | null>(null);
  const [quarterlies, setQuarterlies] = useState<QuarterlyChoice[]>([]);
  const [quarterlyLoading, setQuarterlyLoading] = useState(true);
  const [quarterlyError, setQuarterlyError] = useState('');
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<QuarterlyDay | null>(null);
  const { data: plansData, isLoading: plansLoading, error: plansError } = useListReadingPlans();
  const { data: progressData } = useGetReadingProgress();
  const completeDay = useCompleteReadingDay();

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function loadQuarterly() {
      try {
        const sessionToken = await getToken();
        if (!sessionToken) throw new Error('Your session has expired. Sign in again.');
        const query = selectedEditionId
          ? `?edition_id=${encodeURIComponent(selectedEditionId)}`
          : '';
        const response = await fetch(`/api/reading-plans/quarterly${query}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Could not load the quarterly lessons.');
        if (active) {
          setQuarterly(result.quarterly as Quarterly);
          setQuarterlies(result.quarterlies as QuarterlyChoice[]);
          setQuarterlyError('');
          setOpenWeek(null);
          setSelectedDay(null);
        }
      } catch (error) {
        if (active) {
          setQuarterlyError(error instanceof Error ? error.message : 'Could not load the quarterly lessons.');
        }
      } finally {
        if (active) setQuarterlyLoading(false);
      }
    }
    setQuarterlyLoading(true);
    void loadQuarterly();
    return () => { active = false; };
  }, [getToken, selectedEditionId, token]);

  const completedDays = useMemo(
    () => new Set(
      (progressData?.progress ?? [])
        .filter((progress) => progress.completed)
        .map((progress) => progress.planDayId),
    ),
    [progressData?.progress],
  );
  const plans = plansData?.plans ?? [];

  const markDayComplete = (dayId: number) => {
    completeDay.mutate(
      { dayId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetReadingProgressQueryKey() });
          toast({ description: 'Reading day marked complete.' });
        },
        onError: () => toast({
          title: 'Could not save your progress',
          description: 'Please try again.',
          variant: 'destructive',
        }),
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-primary">Grow a little each day</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bible study</h1>
        <p className="max-w-2xl text-muted-foreground">
          Explore the Sabbath School quarterly or continue one of your reading plans.
        </p>
      </header>

      <Tabs defaultValue="quarterly" className="space-y-6">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 rounded-xl p-1">
          <TabsTrigger value="quarterly" className="gap-2 rounded-lg py-2.5">
            <BookOpen className="size-4" aria-hidden="true" />
            Quarterly
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2 rounded-lg py-2.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            Reading plans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quarterly" className="space-y-5">
          {quarterlyLoading ? (
            <Card className="animate-pulse">
              <CardContent className="space-y-4 p-6">
                <div className="h-5 w-2/5 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
                <div className="h-40 rounded bg-muted" />
              </CardContent>
            </Card>
          ) : quarterlyError ? (
            <Card><CardContent className="p-6 text-sm text-destructive" role="alert">{quarterlyError}</CardContent></Card>
          ) : quarterly ? (
            <>
              <Card className="overflow-hidden rounded-3xl border-primary/15">
                <CardHeader className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-6 sm:p-8">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        {quarterly.quarter}
                      </p>
                      <CardTitle className="font-serif text-2xl sm:text-3xl">{quarterly.title}</CardTitle>
                      <CardDescription className="text-sm sm:text-base">
                        {quarterly.publication}
                        {quarterly.summary ? ` · ${quarterly.summary}` : ''}
                      </CardDescription>
                    </div>
                    {quarterlies.length > 0 && (
                      <label className="flex min-w-48 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                        Choose a quarter
                        <select
                          value={selectedEditionId || String(quarterly.id ?? '')}
                          onChange={(event) => setSelectedEditionId(event.target.value)}
                          className="h-10 rounded-xl border bg-background px-3 text-sm text-foreground"
                        >
                          {quarterlies.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.quarter}{choice.isCurrent ? ' · Current' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {quarterly.lessons.length ? (
                    <div className="space-y-3">
                      {quarterly.lessons.map((lesson) => {
                        const expanded = openWeek === lesson.week;
                        const days = lesson.days ?? [];
                        return (
                          <section key={lesson.week} className="overflow-hidden rounded-2xl border">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => {
                                setOpenWeek(expanded ? null : lesson.week);
                                setSelectedDay(null);
                              }}
                              className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/40"
                            >
                              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                                {String(lesson.week).padStart(2, '0')}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold">{lesson.title}</span>
                                <span className="mt-1 block text-sm text-muted-foreground">
                                  {days.length ? `${days.length} reading day${days.length === 1 ? '' : 's'}` : 'Lesson schedule'}
                                  {lesson.dateRange ? ` · ${lesson.dateRange}` : ''}
                                  {lesson.page ? ` · Page ${lesson.page}` : ''}
                                </span>
                              </span>
                              <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                            {expanded && (
                              <div className="space-y-4 border-t bg-muted/10 p-4 sm:p-5">
                                {days.length ? (
                                  <>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                      {days.map((day) => (
                                        <button
                                          key={day.id}
                                          type="button"
                                          aria-pressed={selectedDay?.id === day.id}
                                          onClick={() => setSelectedDay(day)}
                                          className={`rounded-xl border p-3 text-left transition-colors ${
                                            selectedDay?.id === day.id
                                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                              : 'bg-background hover:border-primary/40'
                                          }`}
                                        >
                                          <span className="block text-xs font-semibold uppercase tracking-wide text-primary">
                                            {dayNames[day.day - 1] ?? `Day ${day.day}`}
                                          </span>
                                          <span className="mt-1 block text-sm font-medium">{day.title}</span>
                                          {day.scriptureRef && (
                                            <span className="mt-1 block text-xs text-muted-foreground">{day.scriptureRef}</span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                    {selectedDay ? (
                                      <article className="rounded-2xl border bg-background p-5 sm:p-7">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                                          {dayNames[selectedDay.day - 1] ?? `Day ${selectedDay.day}`}
                                          {selectedDay.scriptureRef ? ` · ${selectedDay.scriptureRef}` : ''}
                                        </p>
                                        <h3 className="mt-2 font-serif text-2xl">{selectedDay.title}</h3>
                                        <div className="prose prose-sm mt-5 max-w-none whitespace-pre-wrap leading-7 text-foreground dark:prose-invert">
                                          {selectedDay.content}
                                        </div>
                                      </article>
                                    ) : (
                                      <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">
                                        Select a day to read its lesson.
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <div className="flex gap-3 rounded-xl bg-background p-4 text-sm text-muted-foreground">
                                    <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                    Full daily lessons have not been added for this week yet. Ask an administrator to publish the authorized lesson text.
                                  </div>
                                )}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                      <BookOpen className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                      <p className="mt-3 font-medium">No lessons have been published for this quarter.</p>
                      <p className="mt-1 text-sm text-muted-foreground">An administrator can add the weekly schedule and daily reading text.</p>
                    </div>
                  )}
                  {!quarterly.id && (
                    <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">
                      This built-in schedule contains lesson dates only. Full lesson text must be added by an administrator using content the church is authorized to share.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">No quarterly is available.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          {plansLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((item) => <Card key={item} className="h-48 animate-pulse bg-muted" />)}
            </div>
          ) : plansError ? (
            <Card><CardContent className="p-6 text-sm text-destructive" role="alert">Could not load reading plans.</CardContent></Card>
          ) : plans.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {plans.map((plan) => {
                const done = plan.days.filter((day) => completedDays.has(day.id)).length;
                const percent = plan.days.length ? Math.round((done / plan.days.length) * 100) : 0;
                return (
                  <Card key={plan.id} className="rounded-2xl">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">{plan.title}</CardTitle>
                          {plan.description && <CardDescription className="mt-1">{plan.description}</CardDescription>}
                        </div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {done}/{plan.days.length}
                        </span>
                      </div>
                      <Progress value={percent} className="mt-3 h-2" aria-label={`${percent}% complete`} />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {plan.days.map((day) => {
                        const complete = completedDays.has(day.id);
                        return (
                          <div key={day.id} className="flex items-start gap-3 rounded-xl border p-3">
                            <button
                              type="button"
                              aria-label={`${complete ? 'Completed' : 'Mark complete'}: Day ${day.dayNumber}`}
                              aria-pressed={complete}
                              disabled={complete || completeDay.isPending}
                              onClick={() => markDayComplete(day.id)}
                              className="mt-0.5 shrink-0 rounded-full text-primary disabled:cursor-default"
                            >
                              {complete
                                ? <CheckCircle2 className="size-5" aria-hidden="true" />
                                : <Circle className="size-5" aria-hidden="true" />}
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">Day {day.dayNumber}: {day.passage}</p>
                              {day.reflection && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{day.reflection}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center p-8 text-center">
                <BookOpen className="size-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 font-medium">No reading plans yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Check back when the church team publishes a new plan.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
