import { useState } from 'react';
import { Moon, Sun, Video } from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';

interface SignInScreenProps {
  onSignIn: () => Promise<void>;
  isLoggingIn: boolean;
  authError: string | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function SignInScreen({
  onSignIn,
  isLoggingIn,
  authError,
  darkMode,
  onToggleDarkMode,
}: SignInScreenProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="font-display text-lg font-semibold tracking-tight">
            Meet Studio
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <span className="whitespace-nowrap shrink-0">Green Room</span>
          <span className="whitespace-nowrap shrink-0">Room Policies</span>
          <span className="whitespace-nowrap shrink-0">Live Inspector</span>
          <span className="whitespace-nowrap shrink-0">Transcript Archive</span>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={darkMode ? 'Switch to daylight theme' : 'Switch to dark theme'}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-10 px-6 py-12 lg:grid-cols-12 lg:py-16">
        <div className="flex flex-col justify-between lg:col-span-6 lg:pr-6">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Google Meet Workspace · Pre-Flight &amp; Post-Call Console
            </p>

            <h1 className="mt-4 max-w-xl font-display text-4xl font-semibold tracking-tight text-slate-900 [text-wrap:balance] sm:text-5xl dark:text-slate-50">
              Deliberate control over every Google Meet room.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Configure room access, moderation, and smart recording policies before anyone
              joins, verify your camera and microphone in a calibrated green room, and
              search every past conference transcript in one place.
            </p>

            <div className="mt-8 flex flex-col items-start gap-4">
              <GoogleSignInButton
                onClick={onSignIn}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Connecting Google Meet...' : 'Sign in with Google'}
              />

              {authError && (
                <div
                  role="alert"
                  className="max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
                >
                  {authError}
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Connects directly to your Google Meet account · Tokens stay in memory only
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 sm:grid-cols-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Pre-Flight Policies
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Apply Trusted, Restricted, or Broadcast presets at creation time.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Calibrated Green Room
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Real-time dB mic meter, speaker chime test, mirror, and framing guide.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Transcript Dossier
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Browse participant join windows, Drive recordings, and full transcripts.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative h-80 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 lg:h-full lg:min-h-[480px] dark:border-slate-800">
            {!imageError ? (
              <img
                src="/src/assets/images/meet_studio_backdrop_1795376997204.jpg"
                alt="Minimalist architectural acoustic meeting room with oak paneling and daylight"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-8">
                <div className="text-center text-slate-300">
                  <Video className="mx-auto h-10 w-10 text-blue-400" />
                  <p className="mt-3 text-sm font-medium">Meet Studio Workspace</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-xs font-medium text-slate-300">
                Workspace Integration · Google Meet REST API v2
              </p>
              <p className="mt-1.5 max-w-md text-base font-medium text-white">
                Prepare rooms, lock host permissions, and review conference transcripts
                without hunting across tabs.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
