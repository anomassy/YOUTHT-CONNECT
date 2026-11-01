import {
  Accessibility, Check, LayoutDashboard, Moon, RotateCcw, Sun, Monitor, Type,
  PanelLeftClose, PanelLeft, Music2, Columns2, Smartphone, ShieldCheck,
  LockKeyhole, UserRound, Database, Sparkles,
} from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import {
  useSettings,
  type AccentColor,
  type ContentDensity,
  type FontScale,
  type NavigationLayout,
  type MusicLayout,
  type MobileNavigation,
  type ThemePreference,
} from '@/context/SettingsContext';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: typeof Sun }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-3">{label}</h3>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;
          return (
            <Button
              key={option.value}
              type="button"
              variant={selected ? 'default' : 'outline'}
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className="min-w-24"
            >
              {Icon && <Icon aria-hidden="true" />}
              {option.label}
              {selected && <Check className="ml-auto" aria-hidden="true" />}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const accentOptions: { value: AccentColor; label: string; swatch: string }[] = [
  { value: 'navy', label: 'Navy', swatch: '#28345d' },
  { value: 'teal', label: 'Teal', swatch: '#168477' },
  { value: 'violet', label: 'Violet', swatch: '#6842b8' },
  { value: 'rose', label: 'Rose', swatch: '#a51f50' },
  { value: 'emerald', label: 'Emerald', swatch: '#147348' },
  { value: 'orange', label: 'Orange', swatch: '#a94310' },
  { value: 'cyan', label: 'Cyan', swatch: '#087287' },
  { value: 'plum', label: 'Plum', swatch: '#85308f' },
  { value: 'gold', label: 'Gold', swatch: '#9a6813' },
];

function SettingToggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border p-4 text-left hover:bg-muted/50"
    >
      <span>
        <span className="block font-medium">{label}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
      </span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', enabled ? 'bg-primary' : 'bg-muted-foreground/40')}>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform', enabled ? 'translate-x-5' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { clearMusicPreferences } = useAppContext();
  const { toast } = useToast();
  const {
    theme,
    navigationLayout,
    contentDensity,
    musicLayout,
    fontScale,
    accentColor,
    mobileNavigation,
    highContrast,
    reduceMotion,
    autoplayNext,
    updateSettings,
    resetSettings,
  } = useSettings();

  const clearLocalMusicData = () => {
    if (!window.confirm('Clear liked songs, saved songs, queue, and playback preferences on this device?')) return;
    clearMusicPreferences();
    toast({ description: 'Local music preferences cleared.' });
  };

  const signOut = () => {
    if (window.confirm('Sign out of Youth Connect on this device?')) logout();
  };

  return (
    <div className="settings-page mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <header>
        <p className="text-sm font-medium text-primary">Personalize</p>
        <h1 className="mt-1 text-3xl font-serif">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Make Youth Connect feel comfortable and work the way you prefer.
          These choices are saved on this device.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sun className="size-5 text-primary" /> Appearance</CardTitle>
          <CardDescription>Choose your color theme, accent, and reading size.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ChoiceGroup
            label="Color theme"
            value={theme}
            options={themeOptions}
            onChange={(value) => updateSettings({ theme: value })}
          />
          <div>
            <h3 className="text-sm font-medium mb-3">Accent color</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Accent color">
              {accentOptions.map((accent) => (
                <Button
                  key={accent.value}
                  type="button"
                  variant="outline"
                  aria-pressed={accentColor === accent.value}
                  onClick={() => updateSettings({ accentColor: accent.value })}
                  className={cn('h-11 justify-start', accentColor === accent.value && 'border-primary ring-2 ring-ring')}
                >
                  <span className="size-4 rounded-full" style={{ backgroundColor: accent.swatch }} aria-hidden="true" />
                  {accent.label}
                  {accentColor === accent.value && <Check aria-hidden="true" />}
                </Button>
              ))}
            </div>
          </div>
          <ChoiceGroup
            label="Text size"
            value={fontScale}
            options={[
              { value: 'small' as FontScale, label: 'Small', icon: Type },
              { value: 'standard' as FontScale, label: 'Standard', icon: Type },
              { value: 'large' as FontScale, label: 'Large', icon: Type },
            ]}
            onChange={(value) => updateSettings({ fontScale: value })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutDashboard className="size-5 text-primary" /> Layout</CardTitle>
          <CardDescription>Adjust navigation, spacing, and the music player arrangement.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ChoiceGroup
            label="Desktop navigation"
            value={navigationLayout}
            options={[
              { value: 'expanded' as NavigationLayout, label: 'Expanded', icon: PanelLeft },
              { value: 'compact' as NavigationLayout, label: 'Compact', icon: PanelLeftClose },
            ]}
            onChange={(value) => updateSettings({ navigationLayout: value })}
          />
          <ChoiceGroup
            label="Content spacing"
            value={contentDensity}
            options={[
              { value: 'comfortable' as ContentDensity, label: 'Comfortable' },
              { value: 'compact' as ContentDensity, label: 'Compact' },
            ]}
            onChange={(value) => updateSettings({ contentDensity: value })}
          />
          <ChoiceGroup
            label="Music player layout"
            value={musicLayout}
            options={[
              { value: 'split' as MusicLayout, label: 'Split view', icon: Columns2 },
              { value: 'player-first' as MusicLayout, label: 'Player first', icon: Music2 },
            ]}
            onChange={(value) => updateSettings({ musicLayout: value })}
          />
          <div className="border-t pt-5">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-medium"><Smartphone className="size-4" /> Phone navigation</h3>
            <p className="mb-3 text-sm text-muted-foreground">Choose how the mobile bottom navigation is displayed.</p>
            <ChoiceGroup
              label="Mobile navigation"
              value={mobileNavigation}
              options={[
                { value: 'standard' as MobileNavigation, label: 'Icons + labels' },
                { value: 'compact' as MobileNavigation, label: 'Compact icons' },
              ]}
              onChange={(value) => updateSettings({ mobileNavigation: value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Accessibility className="size-5 text-primary" /> Accessibility</CardTitle>
          <CardDescription>Adjust contrast and motion to suit your needs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingToggle
            label="High contrast"
            description="Strengthen borders and focus outlines throughout the app."
            enabled={highContrast}
            onChange={(enabled) => updateSettings({ highContrast: enabled })}
          />
          <SettingToggle
            label="Reduce motion"
            description="Reduce non-essential animations and transitions."
            enabled={reduceMotion}
            onChange={(enabled) => updateSettings({ reduceMotion: enabled })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> System</CardTitle>
          <CardDescription>Control how playback behaves on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingToggle
            label="Play the next song automatically"
            description="Continue through your queue when a song ends."
            enabled={autoplayNext}
            onChange={(enabled) => updateSettings({ autoplayNext: enabled })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Privacy & security</CardTitle>
          <CardDescription>Manage this device’s saved data and your account session.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Local music data</p>
                <p className="mt-1 text-sm text-muted-foreground">Likes, saved songs, queue, and player preferences are stored in this browser.</p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={clearLocalMusicData}>Clear local data</Button>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Signed in as {user?.email || user?.username || 'Youth Connect user'}</p>
                <p className="mt-1 text-sm text-muted-foreground">Sign out to end this account session on this device.</p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={signOut}>Sign out</Button>
          </div>
          <Button asChild type="button" variant="outline">
            <Link href="/profile"><UserRound aria-hidden="true" /> Manage profile</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={resetSettings}>
          <RotateCcw aria-hidden="true" />
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
