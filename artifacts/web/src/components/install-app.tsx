import { useState, useSyncExternalStore } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallState = {
  canInstall: boolean;
  installed: boolean;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installState: InstallState = {
  canInstall: false,
  installed: typeof window !== 'undefined'
    && (window.matchMedia('(display-mode: standalone)').matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)),
};
const subscribers = new Set<() => void>();

function publishInstallState(nextState: InstallState) {
  installState = nextState;
  subscribers.forEach((subscriber) => subscriber());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    publishInstallState({ ...installState, canInstall: true });
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    publishInstallState({ canInstall: false, installed: true });
  });
}

function subscribeToInstallState(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

function getInstallState() {
  return installState;
}

function getServerInstallState(): InstallState {
  return { canInstall: false, installed: false };
}

export function InstallAppCard() {
  const install = useSyncExternalStore(
    subscribeToInstallState,
    getInstallState,
    getServerInstallState,
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [installError, setInstallError] = useState('');
  const isAppleMobile = typeof navigator !== 'undefined'
    && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  async function installApp() {
    if (!deferredPrompt) {
      setShowInstructions((visible) => !visible);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      publishInstallState({ ...installState, canInstall: false });
      if (choice.outcome === 'dismissed') setShowInstructions(true);
    } catch (error) {
      console.error('Could not show the Youth Connect install prompt.', error);
      setInstallError('The install prompt could not be opened. Use your browser menu to install the app.');
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Smartphone className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold">Install Youth Connect</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the app to your desktop or device home screen for quick access.
            </p>
          </div>
        </div>
        {install.installed ? (
          <p role="status" className="text-sm font-medium text-primary">Youth Connect is installed on this device.</p>
        ) : (
          <Button type="button" variant="outline" className="shrink-0" onClick={() => void installApp()}>
            <Download className="size-4" aria-hidden="true" />
            {install.canInstall ? 'Install app' : isAppleMobile ? 'How to add to Home Screen' : 'Install or add to device'}
          </Button>
        )}
        {showInstructions && !install.installed && (
          <div className="basis-full rounded-lg border bg-background p-4 text-sm text-muted-foreground sm:basis-full">
            {isAppleMobile ? (
              <p>In Safari, tap <strong className="text-foreground">Share</strong>, then choose <strong className="text-foreground">Add to Home Screen</strong>.</p>
            ) : (
              <p>Open your browser menu and choose <strong className="text-foreground">Install Youth Connect</strong> or <strong className="text-foreground">Add to Home Screen</strong>. In Chrome or Edge on desktop, the install icon may also appear in the address bar.</p>
            )}
          </div>
        )}
        {installError && <p role="alert" className="basis-full text-sm text-destructive">{installError}</p>}
      </CardContent>
    </Card>
  );
}
