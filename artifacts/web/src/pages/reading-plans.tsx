import { useListReadingPlans, useGetReadingProgress, useCompleteReadingDay, getGetReadingProgressQueryKey } from '@workspace/api-client-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookMarked, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

type DailyReading = {
  dayId?: number;
  dayNumber?: number;
  passage: string | null;
  date?: string;
  summary: string | null;
  completed?: boolean;
  complete: boolean;
};

export default function ReadingPlans() {
  const { token, getToken } = useAuth();
  const queryClient = useQueryClient();
  const [openDayId, setOpenDayId] = useState<number | null>(null);
  const [openedDayIds, setOpenedDayIds] = useState<Set<number>>(new Set());
  const [dailyReading, setDailyReading] = useState<DailyReading | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [summaryRetry, setSummaryRetry] = useState(0);
  const { data: plansData, isLoading: plansLoading } = useListReadingPlans();
  const { data: progressData, isLoading: progressLoading } = useGetReadingProgress();
  const completeDay = useCompleteReadingDay();

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadDailyReading = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch('/api/reading-plans/daily', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Could not load today’s reading.');
        const reading = result.reading as DailyReading;
        if (!active) return;
        setDailyReading(reading);
        setDailyError('');
        if (!reading.complete && !reading.summary) {
          const summaryResponse = await fetch('/api/reading-plans/daily-summary', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const summaryResult = await summaryResponse.json();
          if (!summaryResponse.ok) throw new Error(summaryResult.detail || 'Could not generate today’s summary.');
          if (active) {
            setDailyReading((current) => current
              ? { ...current, summary: summaryResult.summary as string }
              : current);
          }
        }
      } catch (error) {
        if (active) {
          setDailyError(error instanceof Error ? error.message : 'Could not load today’s reading.');
        }
      } finally {
        if (active) setDailyLoading(false);
      }
    };
    void loadDailyReading();
    return () => { active = false; };
  }, [getToken, token, summaryRetry]);

  const plans = plansData?.plans || [];
  const completedDayIds = new Set(progressData?.progress?.filter(p => p.completed).map(p => p.planDayId) || []);

  const handleComplete = (dayId: number) => {
    completeDay.mutate(
      { dayId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetReadingProgressQueryKey() });
        }
      }
    );
  };

  const handleOpenVerse = (dayId: number) => {
    setOpenDayId((current) => (current === dayId ? null : dayId));
    if (!completedDayIds.has(dayId) && !openedDayIds.has(dayId)) {
      setOpenedDayIds((current) => new Set(current).add(dayId));
      handleComplete(dayId);
    }
  };

  const handleDailyComplete = () => {
    if (!dailyReading?.dayId) return;
    completeDay.mutate(
      { dayId: dailyReading.dayId },
      {
        onSuccess: () => {
          setDailyReading((current) => current ? { ...current, completed: true } : current);
          queryClient.invalidateQueries({ queryKey: getGetReadingProgressQueryKey() });
        },
      },
    );
  };

  if (plansLoading || progressLoading || dailyLoading) {
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-serif text-primary">Reading Plans</h1>
        <p className="text-muted-foreground">Journey through the Word together.</p>
      </div>

      <Card className="border-primary/20">
        <CardHeader className="bg-primary/5">
          <CardTitle className="font-serif">Today’s Bible chapter</CardTitle>
          <CardDescription>
            {dailyReading?.date ? new Date(`${dailyReading.date}T00:00:00`).toLocaleDateString() : 'Your daily reading'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {dailyReading?.complete ? (
            <p className="text-sm text-muted-foreground">You’ve reached the end of this Bible reading schedule. Well done!</p>
          ) : dailyReading ? (
            <>
              <h2 className="text-xl font-semibold text-primary">
                Day {dailyReading.dayNumber}: {dailyReading.passage}
              </h2>
              {dailyReading.summary ? (
                <p className="text-sm leading-6">{dailyReading.summary}</p>
              ) : (
                <div>
                  <p role={dailyError ? 'alert' : undefined} className={dailyError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                    {dailyError || 'The chapter summary is not available yet.'}
                  </p>
                  {dailyError && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setDailyError('');
                        setDailyLoading(true);
                        setSummaryRetry((retry) => retry + 1);
                      }}
                    >
                      Try summary again
                    </Button>
                  )}
                </div>
              )}
              <Button
                onClick={handleDailyComplete}
                disabled={dailyReading.completed || completeDay.isPending}
              >
                {dailyReading.completed ? 'Completed for today' : completeDay.isPending ? 'Saving…' : 'Mark today as read'}
              </Button>
            </>
          ) : dailyError ? (
            <p role="alert" className="text-sm text-destructive">{dailyError}</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-8">
        {plans.map(plan => {
          const totalDays = plan.days.length;
           const completedCount = plan.days.filter(d => completedDayIds.has(d.id) || openedDayIds.has(d.id)).length;
          const progressPercent = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;

          return (
            <Card key={plan.id} className="overflow-hidden border-border">
              <CardHeader className="bg-primary/5 pb-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="bg-primary/10 text-primary p-2 rounded-lg">
                    <BookMarked className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-primary">{progressPercent}%</span>
                </div>
                <CardTitle className="text-2xl font-serif">{plan.title}</CardTitle>
                {plan.description && <CardDescription className="text-base">{plan.description}</CardDescription>}
                
                <div className="mt-4 pt-2">
                  <Progress value={progressPercent} className="h-2 bg-primary/10" />
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <div className="divide-y">
                   {[...plan.days].sort((a, b) => a.dayNumber - b.dayNumber).map(day => {
                     const isComplete = completedDayIds.has(day.id) || openedDayIds.has(day.id);
                     const isOpen = openDayId === day.id;
                    return (
                       <div key={day.id} className={cn("p-4 hover:bg-muted/30 transition-colors", isOpen && "bg-primary/5")}>
                         <div
                           role="button"
                           tabIndex={0}
                           onClick={() => handleOpenVerse(day.id)}
                           onKeyDown={(event) => {
                             if (event.key === 'Enter' || event.key === ' ') handleOpenVerse(day.id);
                           }}
                           className="flex items-center justify-between cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary"
                         >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2",
                            isComplete 
                              ? "bg-secondary text-secondary-foreground border-secondary" 
                              : "bg-background text-muted-foreground border-border"
                          )}>
                            {day.dayNumber}
                          </div>
                          <div>
                            <p className={cn("font-medium text-base", isComplete && "line-through text-muted-foreground")}>
                              {day.passage}
                            </p>
                            {day.reflection && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{day.reflection}</p>
                            )}
                          </div>
                        </div>
                         {isComplete ? <CheckCircle2 className="w-6 h-6 text-secondary shrink-0" /> : <Circle className="w-6 h-6 text-muted-foreground shrink-0" />}
                         </div>
                         {isOpen && (
                           <div className="ml-14 mt-3 rounded-xl border border-primary/15 bg-background p-4 space-y-2">
                             <p className="text-sm font-semibold text-primary">Verse opened</p>
                             <p className="text-sm leading-6">{day.passage}</p>
                             {day.reflection && <p className="text-sm text-muted-foreground leading-6">{day.reflection}</p>}
                             <p className="text-xs font-medium text-secondary">
                               {completeDay.isPending && !completedDayIds.has(day.id) ? 'Saving your read status…' : 'Marked as read'}
                             </p>
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {plans.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No reading plans available.
          </div>
        )}
      </div>
    </div>
  );
}
