import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { formatTime } from '@/lib/format';
import {
  Play, Pause, SkipBack, SkipForward, Music, Shuffle, Repeat, Repeat1,
  ThumbsUp, ThumbsDown, MoreVertical, ListMusic, Bookmark, Download,
  Share2, ListPlus, PlayCircle, X, Heart, Search, Headphones,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/context/SettingsContext';
import { cn } from '@/lib/utils';
import type { GospelTrack } from '@/context/AppContext';

function TrackActions({ track }: { track: GospelTrack }) {
  const {
    enqueueNext,
    enqueueTrack,
    removeFromQueue,
    saveTrack,
    savedTrackIds,
    likedTrackIds,
    rateTrack,
    queuedTrackIds,
  } = useAppContext();
  const { toast } = useToast();
  const inQueue = queuedTrackIds.includes(track.id);
  const isSaved = savedTrackIds.includes(track.id);
  const isLiked = likedTrackIds.includes(track.id);

  const shareTrack = async () => {
    const url = new URL(track.audioUrl ?? window.location.href, window.location.href).href;
    try {
      if (navigator.share) {
        await navigator.share({ title: track.title, text: `Listen to ${track.title} by ${track.artist}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ description: 'Song link copied to clipboard.' });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast({ title: 'Could not share song', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const closeMenu = (event: React.SyntheticEvent<HTMLElement>) => {
    event.currentTarget.closest('details')?.removeAttribute('open');
  };

  return (
    <details className="relative shrink-0">
      <summary
        aria-label={`More options for ${track.title}`}
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        <MoreVertical className="size-5" />
      </summary>
      <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
        <button className="player-menu-item" onClick={(event) => { enqueueNext(track.id); closeMenu(event); }}> <PlayCircle /> Play next</button>
        <button className="player-menu-item" onClick={(event) => { enqueueTrack(track.id); closeMenu(event); }}><ListPlus /> {inQueue ? 'Already in queue' : 'Add to queue'}</button>
        <button className="player-menu-item" onClick={(event) => { saveTrack(track.id); closeMenu(event); }}><Bookmark /> {isSaved ? 'Remove from library' : 'Save to library'}</button>
        <button className="player-menu-item" onClick={(event) => { rateTrack(track.id, 'like'); closeMenu(event); }}><ThumbsUp /> {isLiked ? 'Remove from liked songs' : 'Add to liked songs'}</button>
        {track.audioUrl && (
          <a className="player-menu-item" href={track.audioUrl} download onClick={closeMenu}><Download /> Download</a>
        )}
        {inQueue && <button className="player-menu-item" onClick={(event) => { removeFromQueue(track.id); closeMenu(event); }}><X /> Remove from queue</button>}
        <button className="player-menu-item" onClick={(event) => { closeMenu(event); void shareTrack(); }}><Share2 /> Share</button>
      </div>
    </details>
  );
}

export default function MusicPage() {
  const [libraryView, setLibraryView] = useState<'all' | 'liked' | 'saved'>('all');
  const [search, setSearch] = useState('');
  const { musicLayout } = useSettings();
  const { 
    tracks, 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    currentTime, 
    playNext, 
    playPrev,
    setCurrentTrack,
    seekTo,
    playbackError,
    isShuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeatMode,
    likedTrackIds,
    dislikedTrackIds,
    savedTrackIds,
    rateTrack,
    queuedTrackIds,
    removeFromQueue,
  } = useAppContext();
  const visibleTracks = tracks.filter((track) => (
    libraryView === 'all'
    || (libraryView === 'liked' && likedTrackIds.includes(track.id))
    || (libraryView === 'saved' && savedTrackIds.includes(track.id))
  )).filter((track) => {
    const query = search.trim().toLocaleLowerCase();
    return !query
      || track.title.toLocaleLowerCase().includes(query)
      || track.artist.toLocaleLowerCase().includes(query);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Songs for every moment</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Worship</h1>
          <p className="mt-2 text-muted-foreground">Listen, save your favorites, and keep the music close.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-sm text-muted-foreground">
          <Headphones className="size-4 text-primary" aria-hidden="true" />
          {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
        </div>
      </header>

      {playbackError && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {playbackError}
        </p>
      )}

      <div className={cn('grid gap-8', musicLayout === 'split' && 'md:grid-cols-2')}>
        <section aria-label="Music player" className="flex flex-col items-center rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
          <div className="mb-4 flex w-full items-center justify-between">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={isShuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
              aria-pressed={isShuffle}
              onClick={toggleShuffle}
              className={cn(isShuffle && 'text-primary')}
            >
              <Shuffle />
            </Button>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Now playing</span>
            {currentTrack ? <TrackActions track={currentTrack} /> : <span className="size-9" />}
          </div>
          <div className="relative mb-7 flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-secondary shadow-lg">
            <div className="absolute -right-10 -top-10 size-48 rounded-full border-[24px] border-primary-foreground/10" />
            <div className="absolute -bottom-16 -left-12 size-56 rounded-full border border-secondary/50" />
            <div className={cn('absolute inset-0 bg-black/10 transition-opacity duration-700', isPlaying ? 'opacity-0' : 'opacity-40')} />
            <Music className="relative size-24 text-primary-foreground/85" aria-hidden="true" />
            {isPlaying && <span className="absolute bottom-4 left-4 rounded-full bg-background/20 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur">Now playing</span>}
          </div>
          
          <div className="w-full text-center mb-6">
            <h2 className="text-2xl font-bold truncate px-4">
              {currentTrack?.title || 'Select a song'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1 truncate">
              {currentTrack?.artist || '...'}
            </p>
          </div>

          <div className="w-full space-y-3 mb-8">
            <Slider
              value={[currentTime]}
              max={currentTrack?.duration || 100}
              step={1}
              onValueChange={(val) => seekTo(val[0])}
              disabled={!currentTrack}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>{currentTrack ? formatTime(currentTrack.duration) : '--:--'}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 w-full">
            <button 
              onClick={playPrev}
              disabled={!currentTrack}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-50"
            >
              <SkipBack className="w-6 h-6" />
            </button>
            
            <button 
              onClick={togglePlayPause}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-transform active:scale-95 shadow-md"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>
            
            <button 
              onClick={playNext}
              disabled={!currentTrack}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-50"
            >
              <SkipForward className="w-6 h-6" />
            </button>
          </div>
          <div className="mt-5 flex w-full items-center justify-center gap-4">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={currentTrack && likedTrackIds.includes(currentTrack.id) ? 'Unlike this song' : 'Like this song'}
              aria-pressed={Boolean(currentTrack && likedTrackIds.includes(currentTrack.id))}
              disabled={!currentTrack}
              className={cn(currentTrack && likedTrackIds.includes(currentTrack.id) && 'text-primary')}
              onClick={() => currentTrack && rateTrack(currentTrack.id, 'like')}
            >
              <ThumbsUp />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={currentTrack && dislikedTrackIds.includes(currentTrack.id) ? 'Remove dislike' : 'Dislike this song'}
              aria-pressed={Boolean(currentTrack && dislikedTrackIds.includes(currentTrack.id))}
              disabled={!currentTrack}
              className={cn(currentTrack && dislikedTrackIds.includes(currentTrack.id) && 'text-destructive')}
              onClick={() => currentTrack && rateTrack(currentTrack.id, 'dislike')}
            >
              <ThumbsDown />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Repeat ${repeatMode}`}
              aria-pressed={repeatMode !== 'off'}
              onClick={cycleRepeatMode}
              className={cn(repeatMode !== 'off' && 'text-primary')}
            >
              {repeatMode === 'one' ? <Repeat1 /> : <Repeat />}
            </Button>
          </div>
        </section>

        <section aria-label="Worship music library" className="flex h-full flex-col rounded-3xl border bg-card p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-2 pb-4 pt-2">
            <div>
              <h2 className="font-semibold text-lg">Your library</h2>
              <p className="mt-1 text-xs text-muted-foreground">{queuedTrackIds.length} in your queue</p>
            </div>
            <div className="relative w-full sm:max-w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a song"
                aria-label="Search worship music"
                className="h-9 pl-9"
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto border-b px-1 py-3" role="group" aria-label="Music library filter">
            {([
              { key: 'all', label: 'All songs', icon: ListMusic },
              { key: 'liked', label: 'Liked', icon: Heart },
              { key: 'saved', label: 'Library', icon: Bookmark },
            ] as const).map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={libraryView === key ? 'secondary' : 'ghost'}
                aria-pressed={libraryView === key}
                onClick={() => setLibraryView(key)}
              >
                <Icon aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>
          <div className="min-h-72 flex-1 overflow-y-auto py-2">
            {queuedTrackIds.length > 0 && (
              <div className="border-b pb-2 mb-2">
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Up next</p>
                {queuedTrackIds.map((id) => {
                  const queuedTrack = tracks.find((track) => track.id === id);
                  if (!queuedTrack) return null;
                  return (
                    <div key={`queue-${id}`} className="flex items-center gap-2 px-2">
                      <button
                        type="button"
                        onClick={() => {
                          removeFromQueue(id);
                          setCurrentTrack(queuedTrack);
                        }}
                        className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left hover:bg-muted"
                      >
                        <span className="block truncate text-sm font-medium">{queuedTrack.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{queuedTrack.artist}</span>
                      </button>
                      <TrackActions track={queuedTrack} />
                    </div>
                  );
                })}
              </div>
            )}
            {visibleTracks.length === 0 && (
              <div className="flex flex-col items-center px-4 py-12 text-center">
                <Music className="size-9 text-muted-foreground/60" aria-hidden="true" />
                <p className="mt-3 text-sm text-muted-foreground">
                {tracks.length === 0
                  ? 'Worship music is being prepared. Check back soon.'
                  : search
                    ? 'No songs match your search.'
                  : libraryView === 'liked'
                    ? 'Songs you like will appear here.'
                    : libraryView === 'saved'
                      ? 'Songs saved to your library will appear here.'
                      : 'No songs match this filter.'}
                </p>
              </div>
            )}
            {visibleTracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-xl p-2 transition-colors',
                    isCurrent ? 'bg-primary/10' : 'hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setCurrentTrack(track)}
                    aria-label={`Play ${track.title} by ${track.artist}`}
                    className="flex min-w-0 flex-1 items-center gap-3 p-1 text-left"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center text-sm font-medium text-muted-foreground">
                      {isCurrent && isPlaying ? (
                        <div className="flex items-end justify-center gap-[2px] h-4 w-4" aria-label="Playing">
                          <div className="w-[3px] bg-primary animate-[bounce_1s_infinite] h-2" />
                          <div className="w-[3px] bg-primary animate-[bounce_1s_infinite_0.2s] h-4" />
                          <div className="w-[3px] bg-primary animate-[bounce_1s_infinite_0.4s] h-3" />
                        </div>
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium truncate", isCurrent && "text-primary")}>{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {formatTime(track.duration)}
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    {likedTrackIds.includes(track.id) && <Heart className="size-4 fill-current text-primary" aria-label="Liked" />}
                    <TrackActions track={track} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
