/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  History,
  LogOut,
  Menu,
  MonitorSmartphone,
  Moon,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  Video,
  Webcam,
  X,
} from 'lucide-react';
import { CompanionMode } from './components/CompanionMode';
import { ConferenceHistory } from './components/ConferenceHistory';
import { ConfirmActionModal } from './components/ConfirmActionModal';
import { GreenRoomStage } from './components/GreenRoomStage';
import { LobbyWorkspace } from './components/LobbyWorkspace';
import { SignInScreen } from './components/SignInScreen';
import { SpaceInspector } from './components/SpaceInspector';
import {
  clearAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/auth';
import { createSpace, MeetApiError } from './services/meetApi';
import { PendingConfirmation, Space } from './types/meet';

type WorkspaceTab = 'lobby' | 'companion' | 'inspector' | 'history' | 'hardware';

const NAV_ITEMS: { id: WorkspaceTab; label: string; icon: typeof Video }[] = [
  { id: 'lobby', label: 'Lobby & Green Room', icon: Video },
  { id: 'companion', label: 'Companion Mode', icon: MonitorSmartphone },
  { id: 'inspector', label: 'Room Inspector', icon: SlidersHorizontal },
  { id: 'history', label: 'Conference History', icon: History },
  { id: 'hardware', label: 'Device & Audio Lab', icon: Webcam },
];

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('lobby');

  const [sessionSpaces, setSessionSpaces] = useState<Space[]>([]);
  const [inspectedSpace, setInspectedSpace] = useState<Space | null>(null);
  const [companionSpace, setCompanionSpace] = useState<Space | null>(null);
  const [inspectorQuery, setInspectorQuery] = useState('');
  const [quickJumpInput, setQuickJumpInput] = useState('');
  const [quickCreating, setQuickCreating] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
        setAuthError(null);
      },
      () => {
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or could not complete.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setSessionSpaces([]);
    setInspectedSpace(null);
  };

  const handleAuthExpired = () => {
    clearAccessToken();
    setNeedsAuth(true);
    setAuthError('Your Google Meet session expired. Please sign in again to continue.');
  };

  const handleSpaceCreated = (space: Space) => {
    setSessionSpaces((prev) => [
      space,
      ...prev.filter((s) => s.name !== space.name),
    ]);
  };

  const handleSpaceUpdated = (space: Space) => {
    setInspectedSpace(space);
    setSessionSpaces((prev) =>
      prev.map((s) => (s.name === space.name ? space : s))
    );
  };

  const handleQuickCreate = async () => {
    setQuickCreating(true);
    setTopError(null);
    try {
      const created = await createSpace({
        accessType: 'TRUSTED',
        entryPointAccess: 'ALL',
        moderation: 'OFF',
      });
      handleSpaceCreated(created);
      setInspectedSpace(created);
      setActiveTab('inspector');
    } catch (err) {
      if (err instanceof MeetApiError && err.isAuthError) {
        handleAuthExpired();
        return;
      }
      setTopError(
        err instanceof Error ? err.message : 'Unable to create instant meeting room.'
      );
    } finally {
      setQuickCreating(false);
    }
  };

  const handleQuickJump = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickJumpInput.trim();
    if (!trimmed) return;
    setInspectedSpace(null);
    setInspectorQuery(trimmed);
    setActiveTab('inspector');
    setQuickJumpInput('');
  };

  if (needsAuth) {
    return (
      <SignInScreen
        onSignIn={handleLogin}
        isLoggingIn={isLoggingIn}
        authError={authError}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />
    );
  }

  const currentTabLabel =
    NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Lobby & Green Room';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <Video className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-display text-base font-semibold tracking-tight whitespace-nowrap">
                Meet Studio
              </span>
            </div>

            <nav className="space-y-1 px-3 py-4" aria-label="Primary">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? 'Signed-in user'}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {user?.displayName || 'Google User'}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDarkMode((d) => !d)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {darkMode ? (
                  <>
                    <Sun className="h-3.5 w-3.5" />
                    Daylight
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5" />
                    Theater
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/60"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 flex w-72 flex-col justify-between bg-white p-5 dark:bg-slate-900">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-blue-600" />
                    <span className="font-display text-base font-semibold">
                      Meet Studio
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Close navigation menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="mt-4 space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                          active
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                  {user?.email}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDarkMode((d) => !d)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
                  >
                    {darkMode ? 'Daylight' : 'Theater'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium dark:border-slate-700"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden dark:border-slate-700 dark:text-slate-300"
                aria-label="Open navigation menu"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Meet Studio</span>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                  /
                </span>
                <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {currentTabLabel}
                </h1>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-3 sm:max-w-md">
              <form onSubmit={handleQuickJump} className="relative hidden sm:block flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={quickJumpInput}
                  onChange={(e) => setQuickJumpInput(e.target.value)}
                  placeholder="Jump to Meet code or URL..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </form>

              <button
                type="button"
                onClick={handleQuickCreate}
                disabled={quickCreating}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                {quickCreating ? 'Creating...' : 'Instant Room'}
              </button>
            </div>
          </header>

          {topError && (
            <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
              {topError}
            </div>
          )}

          <main className="mx-auto w-full max-w-7xl flex-1 p-6">
            {activeTab === 'lobby' && (
              <LobbyWorkspace
                userName={user?.displayName || user?.email}
                sessionSpaces={sessionSpaces}
                onSpaceCreated={handleSpaceCreated}
                onInspectSpace={(sp) => {
                  setInspectedSpace(sp);
                  setInspectorQuery(sp.meetingCode);
                  setActiveTab('inspector');
                }}
                onOpenCompanion={(sp) => {
                  setCompanionSpace(sp);
                  setActiveTab('companion');
                }}
                onAuthExpired={handleAuthExpired}
              />
            )}

            {activeTab === 'companion' && (
              <CompanionMode
                initialSpace={companionSpace ?? inspectedSpace}
                sessionSpaces={sessionSpaces}
                onSpaceUpdated={handleSpaceUpdated}
                onRequestConfirm={setPendingConfirmation}
                onAuthExpired={handleAuthExpired}
              />
            )}

            {activeTab === 'inspector' && (
              <SpaceInspector
                initialSpace={inspectedSpace}
                initialQuery={inspectorQuery}
                onSpaceUpdated={handleSpaceUpdated}
                onOpenCompanion={(sp) => {
                  setCompanionSpace(sp);
                  setActiveTab('companion');
                }}
                onRequestConfirm={setPendingConfirmation}
                onAuthExpired={handleAuthExpired}
              />
            )}

            {activeTab === 'history' && (
              <ConferenceHistory
                onInspectSpaceCode={(spaceName) => {
                  setInspectedSpace(null);
                  setInspectorQuery(spaceName);
                  setActiveTab('inspector');
                }}
                onGoToLobby={() => setActiveTab('lobby')}
                onAuthExpired={handleAuthExpired}
              />
            )}

            {activeTab === 'hardware' && (
              <div className="mx-auto max-w-4xl space-y-6">
                <GreenRoomStage userName={user?.displayName || user?.email} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Target Audio Gain
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Aim for speech peaks between -18 dB and -6 dB in the meter above
                      for crisp clarity without clipping.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Eye-Line Framing
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Toggle the Framing Grid and position your eyes along the upper
                      horizontal third line for natural presence.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Release Hardware
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Switching views or muting stops local camera tracks cleanly so
                      Google Meet has exclusive access when you join.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <ConfirmActionModal
        confirmation={pendingConfirmation}
        onClose={() => setPendingConfirmation(null)}
      />
    </div>
  );
}
