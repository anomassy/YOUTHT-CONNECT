import { useState } from 'react';
import { useListPrayers, useCreatePrayer, useTogglePray, getListPrayersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Heart, LockKeyhole, Send, Users } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function PrayerWall() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data, isLoading, isError, error } = useListPrayers();
  const createPrayer = useCreatePrayer();
  const togglePray = useTogglePray();

  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [showMine, setShowMine] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createPrayer.mutate(
      { data: { content, isAnonymous } },
      {
        onSuccess: () => {
          setContent('');
          queryClient.invalidateQueries({ queryKey: getListPrayersQueryKey() });
          toast({ description: "Prayer request posted." });
        },
        onError: (error) => {
          toast({
            title: "Could not post request",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleTogglePray = (id: number, currentHasPrayed: boolean) => {
    togglePray.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPrayersQueryKey() }),
      onError: (error) => toast({
        title: currentHasPrayed ? "Could not update prayer status" : "Could not add prayer",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      }),
    });
  };

  const prayers = data?.prayers?.filter((prayer) => !showMine || prayer.isOwn) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 px-6 py-7 text-primary-foreground shadow-sm sm:px-8 sm:py-9">
        <div className="absolute -right-10 -top-14 size-48 rounded-full border-[24px] border-primary-foreground/10" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium">
            <Heart className="size-3.5" aria-hidden="true" /> Prayer room
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Carry one another in prayer</h1>
          <p className="mt-2 max-w-xl text-sm text-primary-foreground/80 sm:text-base">
            Share a request with the community or take a moment to pray for someone.
          </p>
        </div>
      </header>

      <Card className="border-primary/15 shadow-sm">
        <CardHeader className="pb-2">
          <h2 className="font-semibold">Share a prayer request</h2>
          <p className="text-sm text-muted-foreground">Your request can be posted without your name.</p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="What would you like the community to pray for?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              className="min-h-[120px] resize-y bg-background text-base"
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch 
                  id="anonymous" 
                  checked={isAnonymous} 
                  onCheckedChange={setIsAnonymous} 
                />
                <div>
                  <Label htmlFor="anonymous" className="cursor-pointer text-sm font-medium">Post anonymously</Label>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <LockKeyhole className="size-3" aria-hidden="true" /> Your name is hidden from other members
                  </p>
                </div>
              </div>
              <Button type="submit" disabled={!content.trim() || createPrayer.isPending} className="gap-2 rounded-full px-5">
                <Send className="size-4" aria-hidden="true" />
                {createPrayer.isPending ? "Posting..." : "Post Request"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="prayer-requests-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="prayer-requests-heading" className="text-xl font-semibold">Community requests</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-4" aria-hidden="true" />
              {data?.prayers?.length ?? 0} shared {(data?.prayers?.length ?? 0) === 1 ? 'request' : 'requests'}
            </p>
          </div>
          <Button type="button" variant={showMine ? "secondary" : "outline"} onClick={() => setShowMine((value) => !value)}>
            {showMine ? "Show community" : "My requests"}
          </Button>
        </div>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-32 bg-muted animate-pulse" />
          ))
        ) : isError ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load prayer requests. Please try again."}
          </p>
        ) : prayers.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-12 text-center text-muted-foreground">
            {showMine ? "You haven't shared a prayer request yet." : "No prayer requests yet. Be the first to share."}
          </div>
        ) : (
          prayers.map((prayer) => (
            <Card key={prayer.id} className="overflow-hidden rounded-2xl transition-colors hover:border-primary/30">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <p className="font-semibold">
                    {prayer.isAnonymous ? 'Anonymous' : prayer.author}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(prayer.createdAt)}</p>
                </div>
                {prayer.isOwn && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Your request</span>
                )}
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{prayer.content}</p>
              </CardContent>
              <CardFooter className="border-t bg-muted/20 py-3">
                <Button
                  variant={prayer.hasPrayed ? "secondary" : "outline"}
                  size="sm"
                  disabled={togglePray.isPending}
                  className={cn("gap-2 rounded-full", prayer.hasPrayed && "bg-secondary/20 hover:bg-secondary/30 text-secondary-foreground border-transparent")}
                  onClick={() => handleTogglePray(prayer.id, prayer.hasPrayed)}
                >
                  <Heart className={cn("size-4", prayer.hasPrayed ? "fill-secondary text-secondary" : "")} />
                  {prayer.hasPrayed ? "Praying" : "Pray"} 
                  {prayer.prayCount > 0 && <span className="ml-1 opacity-70">({prayer.prayCount})</span>}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
