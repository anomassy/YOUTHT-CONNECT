import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

type QuarterlyLesson = {
  week: number;
  title: string;
  dateRange: string;
  page: number;
};

type Quarterly = {
  title: string;
  publication: string;
  quarter: string;
  summary: string;
  lessons: QuarterlyLesson[];
};

type LessonInsight = {
  theme: string;
  objective: string;
  prompt: string;
};

const monthIndex: Record<string, number> = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

function parseLessonStart(dateRange: string): Date | null {
  const match = dateRange.match(/([A-Za-z]+)\s+(\d{1,2})/);
  if (!match) return null;
  const month = monthIndex[match[1]];
  const day = Number(match[2]);
  if (month === undefined || Number.isNaN(day)) return null;
  return new Date(2026, month, day);
}

function getCurrentQuarterLesson(lessons: QuarterlyLesson[]): QuarterlyLesson | null {
  if (!lessons.length) return null;
  const today = new Date();
  const current = lessons.reduce<QuarterlyLesson | null>((selected, lesson) => {
    const start = parseLessonStart(lesson.dateRange);
    if (!start) return selected;
    if (today >= start) {
      return lesson;
    }
    return selected;
  }, null);
  return current ?? lessons[0];
}

const lessonInsights: Record<number, LessonInsight> = {
  1: {
    theme: 'God speaks and reveals',
    objective: 'Identify how God communicates truth and calls people into relationship.',
    prompt: 'What does this study suggest about the confidence we can place in God’s word?',
  },
  2: {
    theme: 'The call to listen',
    objective: 'Recognize how God equips and commissions His servants.',
    prompt: 'How does obedience shape a prophetic life?',
  },
  3: {
    theme: 'Prophetic warning and hope',
    objective: 'See how Scripture reveals God’s heart for justice, repentance, and restoration.',
    prompt: 'Where do you notice God’s mercy even in moments of warning?',
  },
  4: {
    theme: 'The message of the prophets',
    objective: 'Compare the witness of the old and new covenant prophets.',
    prompt: 'What stays the same in God’s message across the Bible?',
  },
  5: {
    theme: 'Truth rooted in revelation',
    objective: 'Understand why inspiration matters for faith and obedience.',
    prompt: 'How does revelation shape the way we interpret life and history?',
  },
  6: {
    theme: 'Reading with discernment',
    objective: 'Learn to interpret prophetic passages with humility and Scripture in view.',
    prompt: 'Which principles help you avoid misreading Scripture?',
  },
  7: {
    theme: 'God’s voice in the present',
    objective: 'Reflect on how God still speaks through His word and His leading.',
    prompt: 'Where are you hearing God’s voice most clearly right now?',
  },
  8: {
    theme: 'Understanding the unseen',
    objective: 'Examine how prophetic themes point to God’s larger story.',
    prompt: 'What part of God’s plan becomes clearer as you study prophecy?',
  },
  9: {
    theme: 'Discerning truth',
    objective: 'Identify how to test spiritual claims against God’s word.',
    prompt: 'What helps you stay grounded when messages seem confusing or intense?',
  },
  10: {
    theme: 'Prophecy with purpose',
    objective: 'Connect prophecy to everyday faith, witness, and trust.',
    prompt: 'How does this message strengthen your walk with God?',
  },
  11: {
    theme: 'God at work in history',
    objective: 'See how prophecy reveals God’s sovereign purpose across generations.',
    prompt: 'What hope does God’s sovereignty give you in difficult seasons?',
  },
  12: {
    theme: 'The final promise',
    objective: 'Reflect on the hope and victory promised in the end-time vision.',
    prompt: 'Which promise from this study gives you the greatest confidence today?',
  },
  13: {
    theme: 'Living in the light of prophecy',
    objective: 'Apply the study to prayer, obedience, and faithful living.',
    prompt: 'What one change will help you live out this lesson this week?',
  },
};

export default function ReadingPlans() {
  const { token, getToken } = useAuth();
  const [openLessonWeek, setOpenLessonWeek] = useState<number | null>(null);
  const [quarterly, setQuarterly] = useState<Quarterly | null>(null);
  const [quarterlyLoading, setQuarterlyLoading] = useState(true);
  const [quarterlyError, setQuarterlyError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function loadQuarterly() {
      try {
        const sessionToken = await getToken();
        if (!sessionToken) throw new Error('Your session has expired. Sign in again.');
        const response = await fetch('/api/reading-plans/quarterly', {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Could not load the quarterly schedule.');
        if (active) {
          setQuarterly(result.quarterly as Quarterly);
          setQuarterlyError('');
        }
      } catch (error) {
        if (active) setQuarterlyError(error instanceof Error ? error.message : 'Could not load the quarterly schedule.');
      } finally {
        if (active) setQuarterlyLoading(false);
      }
    }
    void loadQuarterly();
    return () => { active = false; };
  }, [getToken, token]);

  const currentLesson = quarterly ? getCurrentQuarterLesson(quarterly.lessons) : null;
  const currentInsight = currentLesson ? lessonInsights[currentLesson.week] : null;

  if (quarterlyLoading) {
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="h-12 bg-muted animate-pulse rounded-xl" />
        <div className="h-96 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-serif text-primary">Sabbath School Lessons</h1>
        <p className="text-muted-foreground">Seventh-day Adventist quarterly Bible study.</p>
      </div>

      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/5 via-background to-secondary/10">
        <CardHeader className="border-b border-primary/10 bg-primary/5 pb-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                {quarterly?.quarter || 'Quarterly Study'}
              </p>
              <CardTitle className="font-serif text-2xl md:text-3xl text-primary">
                {quarterly?.title || 'The Gift of Prophecy'}
              </CardTitle>
            </div>
            <div className="rounded-full border border-primary/20 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {quarterly?.lessons.length || 0} lessons
            </div>
          </div>
          <CardDescription className="mt-2 text-sm md:text-base">
            {quarterly?.publication || 'Adult Sabbath School Bible Study Guide'}
            {quarterly?.summary ? ` · ${quarterly.summary}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {quarterlyLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading quarterly lessons…</p>
          ) : quarterlyError ? (
            <p role="alert" className="p-5 text-sm text-destructive">{quarterlyError}</p>
          ) : quarterly?.lessons.length ? (
            <>
              {currentLesson && currentInsight && (
                <div className="border-b border-primary/10 bg-primary/5 p-4 md:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Current focus</p>
                  <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-foreground">Week {currentLesson.week}: {currentLesson.title}</p>
                      <p className="text-sm text-muted-foreground">{currentLesson.dateRange}</p>
                    </div>
                    <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-primary/15">
                      Page {currentLesson.page}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-primary/10 bg-background/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Theme</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{currentInsight.theme}</p>
                    </div>
                    <div className="rounded-lg border border-primary/10 bg-background/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Objective</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{currentInsight.objective}</p>
                    </div>
                    <div className="rounded-lg border border-primary/10 bg-background/80 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Reflection</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{currentInsight.prompt}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid gap-3 p-4 md:grid-cols-2">
                {quarterly.lessons.map((lesson) => (
                  <div key={lesson.week} className="rounded-xl border border-primary/10 bg-background/70 p-4 shadow-sm transition-colors hover:border-primary/20 hover:bg-primary/5">
                    <button
                      type="button"
                      aria-expanded={openLessonWeek === lesson.week}
                      onClick={() => setOpenLessonWeek((week) => week === lesson.week ? null : lesson.week)}
                      className="w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {lesson.week}
                        </span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          p. {lesson.page}
                        </span>
                      </div>
                      <p className="text-base font-semibold text-foreground">{lesson.title}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{lesson.dateRange}</p>
                      <p className="mt-3 text-xs font-medium text-primary">
                        {openLessonWeek === lesson.week ? 'Close lesson details' : 'Tap to open lesson'}
                      </p>
                    </button>
                    {openLessonWeek === lesson.week && (
                      <div
                        id={`quarterly-lesson-${lesson.week}-details`}
                        className="mt-4 space-y-3 border-t border-primary/10 pt-4"
                      >
                        <h3 className="text-lg font-semibold text-primary">
                          Week {lesson.week}: {lesson.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{lesson.dateRange} · Page {lesson.page}</p>
                        {lessonInsights[lesson.week] && (
                          <div className="space-y-3">
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Theme</h4>
                              <p className="mt-1 text-sm leading-6">{lessonInsights[lesson.week].theme}</p>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Study objective</h4>
                              <p className="mt-1 text-sm leading-6">{lessonInsights[lesson.week].objective}</p>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reflect</h4>
                              <p className="mt-1 text-sm leading-6">{lessonInsights[lesson.week].prompt}</p>
                            </div>
                          </div>
                        )}
                        <p className="text-xs leading-5 text-muted-foreground">
                          Use your authorized quarterly edition for the complete lesson text.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No lessons are available for this quarterly.</p>
          )}
        </CardContent>
      </Card>


    </div>
  );
}
