export function registerServiceWorker(isProduction: boolean, navigatorRef: Navigator): void {
  if (!isProduction || !('serviceWorker' in navigatorRef)) {
    return;
  }

  void navigatorRef.serviceWorker.register('/sw.js');
}
