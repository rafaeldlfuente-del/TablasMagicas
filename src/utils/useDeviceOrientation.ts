import { useState, useEffect } from 'react';

export type DeviceType = 'phone' | 'tablet' | 'desktop';

export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';

  const ua = (navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '').toLowerCase();
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  
  // Screen dimensions in logical CSS pixels
  const screenMin = Math.min(window.screen.width, window.screen.height);

  // iPadOS Safari reports Macintosh in UA, but has multi-touch
  const isIPad = /macintosh/.test(ua) && hasTouch;

  // Android tablets generally have "Android" without "Mobile"
  const isAndroidTablet = /android/.test(ua) && !/mobile/.test(ua);

  // Explicit tablet keywords
  const isTabletUA = /tablet|ipad|playbook|silk/.test(ua) || isIPad || isAndroidTablet;

  // Phone UAs: iPhone, iPod, Android Mobile, Windows Phone, etc.
  const isPhoneUA = /iphone|ipod|mobile|android.*mobile|blackberry|iemobile|opera mini/.test(ua) && !isTabletUA;

  // On touch devices, screen min dimension >= 600 indicates a tablet
  // (e.g. iPad mini is 768px, Samsung Tab is 800px, 10" is 800-1200px)
  // Phones are almost always < 600px (iPhone 16 Pro Max is 440px)
  if (isTabletUA || (hasTouch && screenMin >= 600)) {
    return 'tablet';
  }

  if (isPhoneUA || (hasTouch && screenMin < 600)) {
    return 'phone';
  }

  // Fallback to desktop/computer
  return 'desktop';
}

export function useDeviceOrientation() {
  const [deviceType, setDeviceType] = useState<DeviceType>(detectDeviceType);
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= window.innerHeight;
  });

  useEffect(() => {
    const updateOrientation = () => {
      setDeviceType(detectDeviceType());
      setIsLandscape(window.innerWidth >= window.innerHeight);
    };

    updateOrientation();

    // Try screen orientation lock API if available in standalone PWA mode
    try {
      const type = detectDeviceType();
      const orientationApi = window.screen?.orientation as { lock?: (o: string) => Promise<void> } | undefined;
      if (orientationApi?.lock) {
        if (type === 'phone') {
          orientationApi.lock('portrait').catch(() => {});
        } else {
          orientationApi.lock('landscape').catch(() => {});
        }
      }
    } catch {
      // Ignored if not supported or denied
    }

    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  // Rules:
  // Smartphone -> ONLY portrait allowed
  // Tablet or Desktop -> ONLY landscape allowed
  const isPhone = deviceType === 'phone';
  const isTabletOrDesktop = deviceType === 'tablet' || deviceType === 'desktop';
  
  const isOrientationValid = isPhone ? !isLandscape : isLandscape;
  const expectedOrientation: 'portrait' | 'landscape' = isPhone ? 'portrait' : 'landscape';

  return {
    deviceType,
    isPhone,
    isTabletOrDesktop,
    isLandscape,
    isOrientationValid,
    expectedOrientation,
  };
}
