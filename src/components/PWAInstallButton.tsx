import {Download, Share, WifiOff, X} from 'lucide-react';
import {useState} from 'react';
import {useOnlineStatus, usePWAInstall} from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Share className="h-3.5 w-3.5 text-sky-400" />
          Install on iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-[#0D1322] p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">
                  Install on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  aria-label="Close install instructions"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-300">
                1. Tap the <strong className="text-sky-300">Share</strong> button in the Safari toolbar.
                <br />
                2. Scroll down and tap{' '}
                <strong className="text-sky-300">Add to Home Screen</strong>.
                <br />
                3. Launch <strong>MoeWorkforce</strong> from your Home Screen like a native app.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-slate-800 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-200 shadow-lg backdrop-blur-xs">
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span>Offline Mode — Cached workspace UI active; live web search requires connection.</span>
    </div>
  );
}
