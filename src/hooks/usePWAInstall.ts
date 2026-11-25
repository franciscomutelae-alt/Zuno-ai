import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type DevicePlatform = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'chromebook' | 'other';
export type BrowserEngine = 'chrome' | 'safari' | 'edge' | 'firefox' | 'samsung' | 'other';

function detectPlatformAndBrowser(): {
  platform: DevicePlatform;
  browser: BrowserEngine;
  platformLabel: string;
  browserLabel: string;
} {
  if (typeof navigator === 'undefined') {
    return {
      platform: 'other',
      browser: 'other',
      platformLabel: 'Computador / Móvel',
      browserLabel: 'Navegador Web',
    };
  }
  const ua = navigator.userAgent || '';

  let platform: DevicePlatform = 'other';
  let platformLabel = 'Computador';
  if (/CrOS/i.test(ua)) {
    platform = 'chromebook';
    platformLabel = 'Chromebook';
  } else if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
    platform = 'ios';
    platformLabel = /iPad/i.test(ua) ? 'iPad (iPadOS)' : 'iPhone (iOS)';
  } else if (/Android/i.test(ua)) {
    platform = 'android';
    platformLabel = /Mobile/i.test(ua) ? 'Android' : 'Tablet Android';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    platform = 'macos';
    platformLabel = 'macOS';
  } else if (/Windows/i.test(ua)) {
    platform = 'windows';
    platformLabel = 'Windows';
  } else if (/Linux/i.test(ua)) {
    platform = 'linux';
    platformLabel = 'Linux';
  }

  let browser: BrowserEngine = 'other';
  let browserLabel = 'Navegador';
  if (/SamsungBrowser/i.test(ua)) {
    browser = 'samsung';
    browserLabel = 'Samsung Internet';
  } else if (/Edg\//i.test(ua)) {
    browser = 'edge';
    browserLabel = 'Microsoft Edge';
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browser = 'firefox';
    browserLabel = 'Firefox';
  } else if (/CriOS|Chrome/i.test(ua)) {
    browser = 'chrome';
    browserLabel = 'Google Chrome';
  } else if (/Safari/i.test(ua)) {
    browser = 'safari';
    browserLabel = 'Safari';
  }

  return { platform, browser, platformLabel, browserLabel };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [deviceInfo] = useState(() => detectPlatformAndBrowser());

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    canInstall: Boolean(deferredPrompt),
    isInstalled,
    isIOS: deviceInfo.platform === 'ios' && !isInstalled,
    platform: deviceInfo.platform,
    browser: deviceInfo.browser,
    platformLabel: deviceInfo.platformLabel,
    browserLabel: deviceInfo.browserLabel,
    promptInstall,
  };
}
