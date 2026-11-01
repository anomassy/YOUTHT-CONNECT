import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type NavigationLayout = 'expanded' | 'compact';
export type ContentDensity = 'comfortable' | 'compact';
export type FontScale = 'small' | 'standard' | 'large';
export type AccentColor =
  | 'navy'
  | 'teal'
  | 'violet'
  | 'rose'
  | 'emerald'
  | 'orange'
  | 'cyan'
  | 'plum'
  | 'gold';
export type MusicLayout = 'split' | 'player-first';
export type MobileNavigation = 'standard' | 'compact';
export type ContrastPreference = 'standard' | 'high';

interface AppearanceSettings {
  theme: ThemePreference;
  navigationLayout: NavigationLayout;
  contentDensity: ContentDensity;
  fontScale: FontScale;
  accentColor: AccentColor;
  musicLayout: MusicLayout;
  mobileNavigation: MobileNavigation;
  highContrast: boolean;
  reduceMotion: boolean;
  autoplayNext: boolean;
}

interface SettingsContextValue extends AppearanceSettings {
  updateSettings: (settings: Partial<AppearanceSettings>) => void;
  resetSettings: () => void;
}

const STORAGE_KEY = 'yc_appearance_settings';

const DEFAULT_SETTINGS: AppearanceSettings = {
  theme: 'system',
  navigationLayout: 'expanded',
  contentDensity: 'comfortable',
  fontScale: 'standard',
  accentColor: 'navy',
  musicLayout: 'split',
  mobileNavigation: 'standard',
  highContrast: false,
  reduceMotion: false,
  autoplayNext: true,
};

const ACCENT_COLORS: Record<AccentColor, { light: string; dark: string }> = {
  navy: { light: '228 57% 23%', dark: '42 48% 55%' },
  teal: { light: '173 72% 32%', dark: '173 60% 58%' },
  violet: { light: '263 65% 48%', dark: '263 70% 72%' },
  rose: { light: '343 70% 38%', dark: '343 78% 70%' },
  emerald: { light: '155 72% 28%', dark: '155 64% 58%' },
  orange: { light: '23 82% 36%', dark: '25 90% 64%' },
  cyan: { light: '190 82% 30%', dark: '190 82% 60%' },
  plum: { light: '291 58% 36%', dark: '291 65% 70%' },
  gold: { light: '37 78% 34%', dark: '43 78% 63%' },
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readSettings(): AppearanceSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed: Partial<AppearanceSettings> = JSON.parse(saved);
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
      navigationLayout: parsed.navigationLayout === 'compact' ? 'compact' : 'expanded',
      contentDensity: parsed.contentDensity === 'compact' ? 'compact' : 'comfortable',
      fontScale: parsed.fontScale === 'small' || parsed.fontScale === 'large' ? parsed.fontScale : 'standard',
      accentColor: parsed.accentColor && parsed.accentColor in ACCENT_COLORS ? parsed.accentColor : 'navy',
      musicLayout: parsed.musicLayout === 'player-first' ? 'player-first' : 'split',
      mobileNavigation: parsed.mobileNavigation === 'compact' ? 'compact' : 'standard',
      highContrast: parsed.highContrast === true,
      reduceMotion: parsed.reduceMotion === true,
      autoplayNext: parsed.autoplayNext !== false,
    };
  } catch (error) {
    console.warn('Could not read saved appearance settings; using defaults.', error);
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(readSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Could not save appearance settings.', error);
    }

    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const isDark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark.matches);
      root.classList.toggle('dark', isDark);
      const accent = ACCENT_COLORS[settings.accentColor][isDark ? 'dark' : 'light'];
      root.style.setProperty('--primary', accent);
      root.style.setProperty('--ring', accent);
    };
    applyTheme();
    root.dataset.navigation = settings.navigationLayout;
    root.dataset.mobileNavigation = settings.mobileNavigation;
    root.dataset.density = settings.contentDensity;
    root.dataset.contrast = settings.highContrast ? 'high' : 'standard';
    root.dataset.reduceMotion = String(settings.reduceMotion);
    root.style.fontSize = settings.fontScale === 'small' ? '14px' : settings.fontScale === 'large' ? '18px' : '';
    if (settings.theme === 'system') {
      prefersDark.addEventListener('change', applyTheme);
      return () => prefersDark.removeEventListener('change', applyTheme);
    }
    return undefined;
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      updateSettings: (next) => setSettings((current) => ({ ...current, ...next })),
      resetSettings: () => setSettings(DEFAULT_SETTINGS),
    }),
    [settings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
