import { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  MonitorSmartphone,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Video,
} from 'lucide-react';
import {
  buildInviteText,
  formatAccessTypeLabel,
  ROOM_PRESETS,
} from '../data/presets';
import { createSpace, MeetApiError } from '../services/meetApi';
import { Space } from '../types/meet';
import { GreenRoomStage } from './GreenRoomStage';

interface LobbyWorkspaceProps {
  userName?: string | null;
  sessionSpaces: Space[];
  onSpaceCreated: (space: Space) => void;
  onInspectSpace: (space: Space) => void;
  onOpenCompanion: (space: Space) => void;
  onAuthExpired: () => void;
}

interface AgendaItem {
  id: string;
  text: string;
  done: boolean;
}

export function LobbyWorkspace({
  userName,
  sessionSpaces,
  onSpaceCreated,
  onInspectSpace,
  onOpenCompanion,
  onAuthExpired,
}: LobbyWorkspaceProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(ROOM_PRESETS[0].id);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeSpace, setActiveSpace] = useState<Space | null>(
    sessionSpaces[0] ?? null
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pre-call agenda & timer companion
  const [agendaInput, setAgendaInput] = useState('');
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([
    { id: '1', text: 'Context & goals alignment', done: false },
    { id: '2', text: 'Decisions & next owners', done: false },
  ]);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const selectedPreset =
    ROOM_PRESETS.find((p) => p.id === selectedPresetId) ?? ROOM_PRESETS[0];

  const handleCreateSpace = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createSpace(selectedPreset.config);
      setActiveSpace(created);
      onSpaceCreated(created);
    } catch (err) {
      if (err instanceof MeetApiError && err.isAuthError) {
        onAuthExpired();
        return;
      }
      setCreateError(
        err instanceof Error ? err.message : 'Unable to create Google Meet room.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard denied
    }
  };

  const handleAddAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = agendaInput.trim();
    if (!trimmed) return;
    setAgendaItems((prev) => [
      ...prev,
      { id: String(Date.now()), text: trimmed, done: false },
    ]);
    setAgendaInput('');
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left column: Pre-flight Room Launcher */}
        <section className="xl:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Create Configured Meet Room
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Choose access and moderation rules before launching your room
            </p>

            <div className="mt-4">
              <label
                htmlFor="meeting-title-input"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Session Title (for invite block)
              </label>
              <input
                id="meeting-title-input"
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Weekly Product Design Review"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
              />
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Room Policy Preset
              </p>
              <div className="mt-2 space-y-2">
                {ROOM_PRESETS.map((preset) => {
                  const selected = preset.id === selectedPresetId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                        selected
                          ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {preset.name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {preset.subtitle}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {preset.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {createError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
              >
                {createError}
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreateSpace}
                disabled={creating}
                className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
              >
                <Video className="h-4 w-4" />
                {creating ? 'Provisioning Google Meet Room...' : 'Create Google Meet Room'}
              </button>
            </div>
          </div>

          {/* Active Provisioned Room Card */}
          {activeSpace && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Ready to Join · {formatAccessTypeLabel(activeSpace.config?.accessType)}
                  </p>
                  <h3 className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {activeSpace.meetingCode}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {activeSpace.meetingUri}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onInspectSpace(activeSpace)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Tune Policy
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <a
                  href={activeSpace.meetingUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  <ExternalLink className="h-4 w-4" />
                  Join in Google Meet
                </a>

                <button
                  type="button"
                  onClick={() => onOpenCompanion(activeSpace)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <MonitorSmartphone className="h-3.5 w-3.5" />
                  Companion Mode
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'invite',
                      buildInviteText(
                        activeSpace,
                        meetingTitle,
                        agendaItems.map((i) => i.text)
                      )
                    )
                  }
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {copiedId === 'invite' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedId === 'invite' ? 'Invite Copied' : 'Copy Full Invite'}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy('link', activeSpace.meetingUri)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {copiedId === 'link' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedId === 'link' ? 'Link Copied' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right column: Hardware Green Room + Agenda & Pacing Companion */}
        <section className="xl:col-span-7 space-y-6">
          <GreenRoomStage userName={userName} />

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Meeting Agenda &amp; Pacing Timer
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Keep your call structured and copy agenda points directly into invites
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                  <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatTimer(timerSeconds)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setTimerRunning((r) => !r)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {timerRunning ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(25 * 60);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  aria-label="Reset timer to 25 minutes"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleAddAgenda} className="mt-4 flex items-center gap-2">
              <input
                type="text"
                value={agendaInput}
                onChange={(e) => setAgendaInput(e.target.value)}
                placeholder="Add agenda item..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </button>
            </form>

            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {agendaItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() =>
                        setAgendaItems((prev) =>
                          prev.map((a) =>
                            a.id === item.id ? { ...a, done: !a.done } : a
                          )
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span
                      className={`truncate text-xs ${
                        item.done
                          ? 'text-slate-400 line-through dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {item.text}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAgendaItems((prev) => prev.filter((a) => a.id !== item.id))
                    }
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                    aria-label={`Remove ${item.text}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {/* Session Rooms Created Table */}
      {sessionSpaces.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Rooms Created This Session
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Quick access to rooms provisioned during this workspace session
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {sessionSpaces.length} room{sessionSpaces.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Meeting Code</th>
                  <th className="px-6 py-3 font-medium">Access Policy</th>
                  <th className="px-6 py-3 font-medium">Moderation</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sessionSpaces.map((sp) => (
                  <tr
                    key={sp.name}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-6 py-3 font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                      {sp.meetingCode}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {formatAccessTypeLabel(sp.config?.accessType)}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {sp.config?.moderation === 'ON' ? 'Host moderated' : 'Standard'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCompanion(sp)}
                          className="whitespace-nowrap shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Companion
                        </button>
                        <button
                          type="button"
                          onClick={() => onInspectSpace(sp)}
                          className="whitespace-nowrap shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Inspect
                        </button>
                        <a
                          href={sp.meetingUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Join
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
