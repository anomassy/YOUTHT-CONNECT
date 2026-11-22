import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getListReadingPlansQueryKey, useCreateReadingPlan, useListReadingPlans } from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, CalendarDays, Check, FileText, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type GuideDay = { passage: string; reflection: string };
type QuarterlyDay = {
  id: number;
  day: number;
  title: string;
  scriptureRef: string;
  content: string;
};
type Quarterly = {
  id: number;
  title: string;
  publication: string;
  quarter: string;
  summary: string;
  isCurrent: boolean;
  lessons: Array<{ week: number; days: QuarterlyDay[] }>;
};
type QuarterlyChoice = Pick<Quarterly, 'id' | 'title' | 'quarter' | 'isCurrent'>;

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Sabbath'];

export default function AdminStudyGuides() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const { data } = useListReadingPlans();
  const create = useCreateReadingPlan();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [days, setDays] = useState<GuideDay[]>([{ passage: '', reflection: '' }]);
  const [quarterlies, setQuarterlies] = useState<QuarterlyChoice[]>([]);
  const [quarterly, setQuarterly] = useState<Quarterly | null>(null);
  const [selectedQuarterlyId, setSelectedQuarterlyId] = useState('');
  const [quarterlyLoading, setQuarterlyLoading] = useState(true);
  const [quarterlyError, setQuarterlyError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [newQuarterTitle, setNewQuarterTitle] = useState('');
  const [newQuarterName, setNewQuarterName] = useState('');
  const [newPublication, setNewPublication] = useState('Adult Sabbath School Bible Study Guide');
  const [newSummary, setNewSummary] = useState('');
  const [week, setWeek] = useState('1');
  const [day, setDay] = useState('1');
  const [dayTitle, setDayTitle] = useState('');
  const [scriptureRef, setScriptureRef] = useState('');
  const [content, setContent] = useState('');
  const [savingQuarterly, setSavingQuarterly] = useState(false);

  const request = async (path: string, method = 'GET', body?: object) => {
    const token = await getToken();
    if (!token) throw new Error('Your session has expired. Sign in again.');
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.detail || 'The request could not be completed.');
    return result;
  };

  useEffect(() => {
    let active = true;
    async function loadQuarterly() {
      try {
        const query = selectedQuarterlyId
          ? `?edition_id=${encodeURIComponent(selectedQuarterlyId)}`
          : '';
        const result = await request(`/api/reading-plans/quarterly${query}`);
        if (active) {
          setQuarterly(result.quarterly as Quarterly | null);
          setQuarterlies(result.quarterlies as QuarterlyChoice[]);
          setQuarterlyError('');
        }
      } catch (error) {
        if (active) setQuarterlyError(error instanceof Error ? error.message : 'Could not load quarterlies.');
      } finally {
        if (active) setQuarterlyLoading(false);
      }
    }
    setQuarterlyLoading(true);
    void loadQuarterly();
    return () => { active = false; };
  }, [getToken, refreshKey, selectedQuarterlyId]);

  const existingDays = useMemo(
    () => quarterly?.lessons.flatMap((lesson) => lesson.days.map((item) => ({
      week: lesson.week,
      ...item,
    }))) ?? [],
    [quarterly?.lessons],
  );

  const updateDay = (index: number, key: keyof GuideDay, value: string) => {
    setDays((current) => current.map((item, i) => i === index ? { ...item, [key]: value } : item));
  };

  const submitPlan = (event: React.FormEvent) => {
    event.preventDefault();
    const validDays = days.filter((item) => item.passage.trim());
    if (!title.trim() || !validDays.length) {
      toast({ title: 'Incomplete study plan', description: 'Add a title and at least one reading.', variant: 'destructive' });
      return;
    }
    create.mutate({
      data: {
        title: title.trim(),
        description: description.trim(),
        days: validDays.map((item, index) => ({
          dayNumber: index + 1,
          passage: item.passage.trim(),
          reflection: item.reflection.trim(),
        })),
      },
    }, {
      onSuccess: () => {
        setTitle('');
        setDescription('');
        setDays([{ passage: '', reflection: '' }]);
        queryClient.invalidateQueries({ queryKey: getListReadingPlansQueryKey() });
        toast({ description: 'Reading plan created.' });
      },
      onError: () => toast({ title: 'Could not create reading plan', description: 'Please try again.', variant: 'destructive' }),
    });
  };

  const createQuarterly = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newQuarterTitle.trim() || !newQuarterName.trim() || !newPublication.trim()) {
      toast({ title: 'Quarterly details are incomplete', description: 'Enter the title, quarter, and publication.', variant: 'destructive' });
      return;
    }
    setSavingQuarterly(true);
    try {
      const result = await request('/api/reading-plans/quarterly', 'POST', {
        title: newQuarterTitle.trim(),
        quarter: newQuarterName.trim(),
        publication: newPublication.trim(),
        summary: newSummary.trim(),
      });
      setSelectedQuarterlyId(String(result.quarterly.id));
      setNewQuarterTitle('');
      setNewQuarterName('');
      setNewSummary('');
      setRefreshKey((value) => value + 1);
      toast({ description: 'Quarterly created and set as current. Add its daily lessons below.' });
    } catch (error) {
      toast({
        title: 'Could not create quarterly',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingQuarterly(false);
    }
  };

  const saveQuarterlyDay = async (event: React.FormEvent) => {
    event.preventDefault();
    const editionId = selectedQuarterlyId || String(quarterly?.id ?? '');
    if (!editionId || !dayTitle.trim() || !content.trim()) {
      toast({ title: 'Lesson details are incomplete', description: 'Choose a quarter and enter the day title and lesson text.', variant: 'destructive' });
      return;
    }
    setSavingQuarterly(true);
    try {
      await request(`/api/reading-plans/quarterly/${editionId}/days`, 'PUT', {
        week: Number(week),
        day: Number(day),
        title: dayTitle.trim(),
        scriptureRef: scriptureRef.trim(),
        content: content.trim(),
      });
      setDayTitle('');
      setScriptureRef('');
      setContent('');
      setRefreshKey((value) => value + 1);
      toast({ description: 'Daily lesson saved.' });
    } catch (error) {
      toast({
        title: 'Could not save daily lesson',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingQuarterly(false);
    }
  };

  const setCurrent = async () => {
    const editionId = selectedQuarterlyId || String(quarterly?.id ?? '');
    if (!editionId) return;
    setSavingQuarterly(true);
    try {
      await request(`/api/reading-plans/quarterly/${editionId}/current`, 'PATCH');
      setRefreshKey((value) => value + 1);
      toast({ description: 'Current quarterly updated.' });
    } catch (error) {
      toast({
        title: 'Could not update current quarterly',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingQuarterly(false);
    }
  };

  const editDay = (item: QuarterlyDay & { week: number }) => {
    setWeek(String(item.week));
    setDay(String(item.day));
    setDayTitle(item.title);
    setScriptureRef(item.scriptureRef);
    setContent(item.content);
    document.getElementById('quarterly-day-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <header>
        <p className="text-sm font-semibold text-primary">Content management</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Quarterlies & reading plans</h1>
        <p className="mt-2 text-muted-foreground">Publish authorized daily lesson text and build reading plans for members.</p>
      </header>

      <Tabs defaultValue="quarterly" className="space-y-6">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 rounded-xl p-1">
          <TabsTrigger value="quarterly" className="gap-2 rounded-lg py-2.5"><BookOpen className="size-4" aria-hidden="true" /> Quarterlies</TabsTrigger>
          <TabsTrigger value="plans" className="gap-2 rounded-lg py-2.5"><CalendarDays className="size-4" aria-hidden="true" /> Reading plans</TabsTrigger>
        </TabsList>

        <TabsContent value="quarterly" className="space-y-5">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Add a quarterly edition</CardTitle>
              <CardDescription>Older editions remain available. New editions automatically become current.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createQuarterly} className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium">
                  Edition title
                  <Input value={newQuarterTitle} onChange={(event) => setNewQuarterTitle(event.target.value)} placeholder="The Gift of Prophecy" required />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Quarter
                  <Input value={newQuarterName} onChange={(event) => setNewQuarterName(event.target.value)} placeholder="Q1 2027" required />
                </label>
                <label className="space-y-1.5 text-sm font-medium md:col-span-2">
                  Publication
                  <Input value={newPublication} onChange={(event) => setNewPublication(event.target.value)} required />
                </label>
                <label className="space-y-1.5 text-sm font-medium md:col-span-2">
                  Summary
                  <Textarea value={newSummary} onChange={(event) => setNewSummary(event.target.value)} placeholder="A short overview for members" />
                </label>
                <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground md:col-span-2">
                  <FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Add only lesson text your church is authorized to publish. The app does not fetch or reproduce copyrighted quarterly content.
                </div>
                <Button type="submit" disabled={savingQuarterly} className="w-fit gap-2">
                  <Plus className="size-4" aria-hidden="true" />
                  {savingQuarterly ? 'Creating…' : 'Create quarterly'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Publish daily lessons</CardTitle>
                  <CardDescription className="mt-1">Save a day by week. Re-saving the same day replaces its text.</CardDescription>
                </div>
                {quarterly && !quarterly.isCurrent && (
                  <Button type="button" variant="outline" onClick={() => void setCurrent()} disabled={savingQuarterly}>
                    Set as current
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {quarterlyLoading ? (
                <p className="text-sm text-muted-foreground">Loading quarterlies…</p>
              ) : quarterlyError ? (
                <p role="alert" className="text-sm text-destructive">{quarterlyError}</p>
              ) : quarterlies.length === 0 ? (
                <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                  Create a quarterly edition before adding daily lessons.
                </p>
              ) : (
                <>
                  <label className="block max-w-sm space-y-1.5 text-sm font-medium">
                    Quarterly edition
                    <select
                      value={selectedQuarterlyId || String(quarterly?.id ?? '')}
                      onChange={(event) => setSelectedQuarterlyId(event.target.value)}
                      className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                    >
                      {quarterlies.map((item) => (
                        <option key={item.id} value={item.id}>{item.quarter} — {item.title}{item.isCurrent ? ' (current)' : ''}</option>
                      ))}
                    </select>
                  </label>
                  <form id="quarterly-day-editor" onSubmit={saveQuarterlyDay} className="grid gap-4 rounded-2xl border bg-muted/10 p-4 sm:grid-cols-2 sm:p-5">
                    <label className="space-y-1.5 text-sm font-medium">
                      Week
                      <Input type="number" min={1} max={13} value={week} onChange={(event) => setWeek(event.target.value)} required />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium">
                      Day
                      <select value={day} onChange={(event) => setDay(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                        {weekdays.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                      Day title
                      <Input value={dayTitle} onChange={(event) => setDayTitle(event.target.value)} required />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                      Scripture reference
                      <Input value={scriptureRef} onChange={(event) => setScriptureRef(event.target.value)} placeholder="Optional" />
                    </label>
                    <label className="space-y-1.5 text-sm font-medium sm:col-span-2">
                      Full daily lesson
                      <Textarea value={content} onChange={(event) => setContent(event.target.value)} className="min-h-48 resize-y" required />
                    </label>
                    <Button type="submit" disabled={savingQuarterly} className="w-fit gap-2">
                      <Save className="size-4" aria-hidden="true" />
                      {savingQuarterly ? 'Saving…' : 'Save daily lesson'}
                    </Button>
                  </form>
                  <div className="space-y-3">
                    <h3 className="font-semibold">Published days ({existingDays.length})</h3>
                    {existingDays.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {existingDays.map((item) => (
                          <button
                            key={`${item.week}-${item.day}`}
                            type="button"
                            onClick={() => editDay(item)}
                            className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left hover:border-primary/40 hover:bg-muted/30"
                          >
                            <span className="min-w-0">
                              <span className="block text-xs font-medium text-muted-foreground">Week {item.week} · {weekdays[item.day - 1]}</span>
                              <span className="mt-1 block truncate text-sm font-semibold">{item.title}</span>
                            </span>
                            <Check className="size-4 shrink-0 text-primary" aria-label="Published" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No daily lessons added to this edition yet.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-5">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="size-5 text-primary" aria-hidden="true" /> Create a reading plan</CardTitle>
              <CardDescription>Build a shorter plan with a passage and reflection for each day.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitPlan} className="space-y-5">
                <Input placeholder="Plan title" value={title} onChange={(event) => setTitle(event.target.value)} required />
                <Textarea placeholder="Short description" value={description} onChange={(event) => setDescription(event.target.value)} />
                <div className="space-y-3">
                  {days.map((item, index) => (
                    <div key={index} className="space-y-3 rounded-xl border p-4">
                      <p className="text-sm font-semibold">Day {index + 1}</p>
                      <Input placeholder="Bible passage" value={item.passage} onChange={(event) => updateDay(index, 'passage', event.target.value)} />
                      <Textarea placeholder="Reflection (optional)" value={item.reflection} onChange={(event) => updateDay(index, 'reflection', event.target.value)} />
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setDays((current) => [...current, { passage: '', reflection: '' }])}>
                    <Plus className="mr-2 size-4" aria-hidden="true" /> Add day
                  </Button>
                </div>
                <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create plan'}</Button>
              </form>
            </CardContent>
          </Card>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Existing reading plans</h2>
            {data?.plans?.length ? data.plans.map((plan) => (
              <Card key={plan.id}><CardContent className="p-4">
                <p className="font-semibold">{plan.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.days.length} day{plan.days.length === 1 ? '' : 's'}
                  {plan.description ? ` · ${plan.description}` : ''}
                </p>
              </CardContent></Card>
            )) : <p className="py-6 text-sm text-muted-foreground">No reading plans yet.</p>}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
