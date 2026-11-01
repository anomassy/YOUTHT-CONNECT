import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getListMusicQueryKey, useListMusic } from '@workspace/api-client-react';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

export interface GospelTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audioUrl: string | null;
}

const ADJECTIVES = ["Swift", "Gentle", "Brave", "Quiet", "Bright", "Loyal", "Kind", "Calm", "Fierce", "Noble"];
const ANIMALS = ["Dove", "Lion", "Lamb", "Eagle", "Hart", "Stag", "Sparrow", "Owl", "Hawk", "Fish"];

function generateAnonAlias() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${animal}${num}`;
}

interface AppContextType {
  isAdmin: boolean;
  anonAlias: string;
  tracks: GospelTrack[];
  currentTrack: GospelTrack | null;
  isPlaying: boolean;
  playbackError: string | null;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  likedTrackIds: string[];
  dislikedTrackIds: string[];
  savedTrackIds: string[];
  queuedTrackIds: string[];
  setCurrentTrack: (track: GospelTrack | null) => void;
  togglePlayPause: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  rateTrack: (trackId: string, rating: 'like' | 'dislike') => void;
  saveTrack: (trackId: string) => void;
  enqueueNext: (trackId: string) => void;
  enqueueTrack: (trackId: string) => void;
  removeFromQueue: (trackId: string) => void;
  clearMusicPreferences: () => void;
  currentTime: number;
  playNext: () => void;
  playPrev: () => void;
  seekTo: (time: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function readStoredIds(key: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    console.warn(`Could not read saved music data for ${key}.`, error);
    return [];
  }
}

function readStoredValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Could not read saved music setting ${key}.`, error);
    return null;
  }
}

function storeMusicValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Could not save music setting ${key}.`, error);
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdminAuthenticated } = useAuth();
  const { autoplayNext } = useSettings();
  const [anonAlias, setAnonAlias] = useState<string>('');
  const [currentTrack, setCurrentTrack] = useState<GospelTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isShuffle, setIsShuffle] = useState(() => readStoredValue('yc_music_shuffle') === 'true');
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>(() => {
    const value = readStoredValue('yc_music_repeat');
    return value === 'all' || value === 'one' ? value : 'off';
  });
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>(() => readStoredIds('yc_music_liked'));
  const [dislikedTrackIds, setDislikedTrackIds] = useState<string[]>(() => readStoredIds('yc_music_disliked'));
  const [savedTrackIds, setSavedTrackIds] = useState<string[]>(() => readStoredIds('yc_music_saved'));
  const [queuedTrackIds, setQueuedTrackIds] = useState<string[]>(() => readStoredIds('yc_music_queue'));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playNextRef = useRef<() => void>(() => {});
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;

  const { data: musicData } = useListMusic({
    query: {
      queryKey: getListMusicQueryKey(),
      enabled: isAuthenticated,
      staleTime: 5 * 60 * 1000,
    },
  });

  const tracks = useMemo<GospelTrack[]>(
    () => [
      ...(musicData?.tracks ?? []).map((track) => ({
        id: `server-${track.id}`,
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        audioUrl: track.audioUrl,
      })),
    ],
    [musicData?.tracks],
  );

  useEffect(() => {
    let storedAlias = localStorage.getItem('yc_anon_alias');
    if (!storedAlias) {
      storedAlias = generateAnonAlias();
      localStorage.setItem('yc_anon_alias', storedAlias);
    }
    setAnonAlias(storedAlias);
  }, []);

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        void audio.play().catch(() => {
          setIsPlaying(false);
          setPlaybackError('Playback was blocked. Press play again to start the track.');
        });
        return;
      }
      if (!autoplayNext) {
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }
      playNextRef.current();
    };
    const onError = () => {
      setIsPlaying(false);
      setPlaybackError('This audio file could not be played. Try another track.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    setPlaybackError(null);

    if (currentTrack?.audioUrl) {
      audio.pause();
      audio.src = currentTrack.audioUrl;
      audio.preload = 'auto';
      audio.load();
      if (isPlaying) {
        void audio.play().catch(() => {
          setIsPlaying(false);
          setPlaybackError('Playback was blocked. Press play again to start the track.');
        });
      }
    } else {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentTrack?.id, autoplayNext]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) return;
    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
        setPlaybackError('Playback was blocked. Press play again to start the track.');
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.audioUrl]);

  const togglePlayPause = () => {
    if (!currentTrack) {
      if (tracks[0]) {
        handleSetCurrentTrack(tracks[0]);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSetCurrentTrack = (track: GospelTrack | null) => {
    setCurrentTrack(track);
    setCurrentTime(0);
    setPlaybackError(null);
    if (track) setIsPlaying(true);
    else setIsPlaying(false);
  };

  const playSelected = (trackId: string, nextQueue?: string[]) => {
    const nextTrack = tracks.find((track) => track.id === trackId);
    if (!nextTrack) return false;
    if (nextQueue) setQueuedTrackIds(nextQueue);
    if (currentTrack?.id === nextTrack.id) {
      setCurrentTime(0);
      setPlaybackError(null);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play().catch(() => {
          setIsPlaying(false);
          setPlaybackError('Playback was blocked. Press play again to start the track.');
        });
      }
      return true;
    }
    handleSetCurrentTrack(nextTrack);
    return true;
  };

  const playNext = () => {
    if (!currentTrack) return;
    const queuedTrackId = queuedTrackIds.find((id) => tracks.some((track) => track.id === id));
    if (queuedTrackId) {
      playSelected(queuedTrackId, queuedTrackIds.filter((id) => id !== queuedTrackId));
      return;
    }
    if (tracks.length < 2) {
      if (repeatMode !== 'off') {
        setCurrentTime(0);
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          void audio.play().catch(() => {
            setIsPlaying(false);
            setPlaybackError('Playback was blocked. Press play again to start the track.');
          });
        }
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
      return;
    }
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (isShuffle) {
      const candidates = tracks.filter((track) => track.id !== currentTrack.id);
      playSelected(candidates[Math.floor(Math.random() * candidates.length)].id);
      return;
    }
    if (idx === tracks.length - 1 && repeatMode !== 'all') {
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }
    playSelected(tracks[(idx + 1) % tracks.length].id);
  };

  playNextRef.current = playNext;

  const playPrev = () => {
    if (!currentTrack || tracks.length < 2) return;
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx === 0 && repeatMode !== 'all') {
      seekTo(0);
      return;
    }
    playSelected(tracks[(idx - 1 + tracks.length) % tracks.length].id);
  };

  const seekTo = (time: number) => {
    setCurrentTime(time);
    if (audioRef.current && currentTrack?.audioUrl) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleShuffle = () => setIsShuffle((value) => !value);

  const cycleRepeatMode = () => {
    setRepeatMode((value) => (value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'));
  };

  const rateTrack = (trackId: string, rating: 'like' | 'dislike') => {
    const selected = rating === 'like' ? likedTrackIds : dislikedTrackIds;
    const updateSelected = rating === 'like' ? setLikedTrackIds : setDislikedTrackIds;
    const updateOpposite = rating === 'like' ? setDislikedTrackIds : setLikedTrackIds;
    updateSelected(selected.includes(trackId) ? selected.filter((id) => id !== trackId) : [...selected, trackId]);
    updateOpposite((ids) => ids.filter((id) => id !== trackId));
  };

  const saveTrack = (trackId: string) => {
    setSavedTrackIds((ids) =>
      ids.includes(trackId) ? ids.filter((id) => id !== trackId) : [...ids, trackId],
    );
  };

  const enqueueNext = (trackId: string) => {
    setQueuedTrackIds((ids) => [trackId, ...ids.filter((id) => id !== trackId)]);
  };

  const enqueueTrack = (trackId: string) => {
    setQueuedTrackIds((ids) => (ids.includes(trackId) ? ids : [...ids, trackId]));
  };

  const removeFromQueue = (trackId: string) => {
    setQueuedTrackIds((ids) => ids.filter((id) => id !== trackId));
  };

  const clearMusicPreferences = () => {
    setLikedTrackIds([]);
    setDislikedTrackIds([]);
    setSavedTrackIds([]);
    setQueuedTrackIds([]);
    setIsShuffle(false);
    setRepeatMode('off');
  };

  useEffect(() => {
    storeMusicValue('yc_music_shuffle', String(isShuffle));
  }, [isShuffle]);

  useEffect(() => {
    storeMusicValue('yc_music_repeat', repeatMode);
  }, [repeatMode]);

  useEffect(() => {
    storeMusicValue('yc_music_liked', JSON.stringify(likedTrackIds));
  }, [likedTrackIds]);

  useEffect(() => {
    storeMusicValue('yc_music_disliked', JSON.stringify(dislikedTrackIds));
  }, [dislikedTrackIds]);

  useEffect(() => {
    storeMusicValue('yc_music_saved', JSON.stringify(savedTrackIds));
  }, [savedTrackIds]);

  useEffect(() => {
    storeMusicValue('yc_music_queue', JSON.stringify(queuedTrackIds));
  }, [queuedTrackIds]);

  return (
    <AppContext.Provider
      value={{
        isAdmin: isAdminAuthenticated,
        anonAlias,
        tracks,
        currentTrack,
        isPlaying,
        playbackError,
        isShuffle,
        repeatMode,
        likedTrackIds,
        dislikedTrackIds,
        savedTrackIds,
        queuedTrackIds,
        setCurrentTrack: handleSetCurrentTrack,
        togglePlayPause,
        toggleShuffle,
        cycleRepeatMode,
        rateTrack,
        saveTrack,
        enqueueNext,
        enqueueTrack,
        removeFromQueue,
        clearMusicPreferences,
        currentTime,
        playNext,
        playPrev,
        seekTo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
