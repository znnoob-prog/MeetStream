import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Monitor,
  MonitorOff,
  Pause,
  PhoneOff,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Users,
  VolumeX,
} from 'lucide-react';
import {
  formatAccessTypeLabel,
  formatDuration,
  formatTimeOnly,
  getParticipantDisplayName,
  getParticipantTypeLabel,
} from '../data/presets';
import {
  endActiveConference,
  getSpace,
  listParticipants,
  listTranscriptEntries,
  listTranscripts,
  MeetApiError,
  patchSpace,
} from '../services/meetApi';
import {
  Participant,
  PendingConfirmation,
  Space,
  SpaceConfig,
  TranscriptEntry,
} from '../types/meet';

interface CompanionModeProps {
  initialSpace: Space | null;
  sessionSpaces: Space[];
  onSpaceUpdated: (space: Space) => void;
  onRequestConfirm: (confirmation: PendingConfirmation) => void;
  onAuthExpired: () => void;
}

interface ActionItem {
  id: string;
  task: string;
  owner: string;
  done: boolean;
}

export function CompanionMode({
  initialSpace,
  sessionSpaces,
  onSpaceUpdated,
  onRequestConfirm,
  onAuthExpired,
}: CompanionModeProps) {
  const [roomInput, setRoomInput] = useState(
    initialSpace?.meetingCode || sessionSpaces[0]?.meetingCode || ''
  );
  const [space, setSpace] = useState<Space | null>(
    initialSpace ?? sessionSpaces[0] ?? null
  );
  const [connecting, setConnecting] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Live conference data polling
  const [autoSync, setAutoSync] = useState(false);
  const [syncingData, setSyncingData] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [stageTab, setStageTab] = useState<'room' | 'screen'>('room');

  // Second-screen presentation preview (echo-free, display-only)
  const displayVideoRef = useRef<HTMLVideoElement | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);

  // Companion Timekeeper
  const [timerPresetMin, setTimerPresetMin] = useState(30);
  const [timerSeconds, setTimerSeconds] = useState(30 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Companion Notes & Action Items
  const [notes, setNotes] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [ownerInput, setOwnerInput] = useState('');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const stopScreenPreview = useCallback(() => {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }
    if (displayVideoRef.current) {
      displayVideoRef.current.srcObject = null;
    }
    setScreenSharing(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScreenPreview();
    };
  }, [stopScreenPreview]);

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

  const syncLiveRoomData = useCallback(
    async (targetSpace: Space) => {
      setSyncingData(true);
      setRoomError(null);
      try {
        const freshSpace = await getSpace(targetSpace.name);
        setSpace(freshSpace);
        onSpaceUpdated(freshSpace);

        const recordName = freshSpace.activeConference?.conferenceRecord;
        if (recordName) {
          const [parts, trans] = await Promise.all([
            listParticipants(recordName),
            listTranscripts(recordName),
          ]);
          setParticipants(parts);
          if (trans.length > 0) {
            const entries = await listTranscriptEntries(trans[0].name);
            setTranscriptEntries(entries);
          } else {
            setTranscriptEntries([]);
          }
        } else {
          setParticipants([]);
          setTranscriptEntries([]);
        }
        setLastSyncedAt(
          new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
          }).format(new Date())
        );
      } catch (err) {
        if (err instanceof MeetApiError && err.isAuthError) {
          onAuthExpired();
          return;
        }
        setRoomError(
          err instanceof Error
            ? err.message
            : 'Unable to refresh live Google Meet room status.'
        );
      } finally {
        setSyncingData(false);
      }
    },
    [onAuthExpired, onSpaceUpdated]
  );

  useEffect(() => {
    if (initialSpace) {
      setSpace(initialSpace);
      setRoomInput(initialSpace.meetingCode);
      syncLiveRoomData(initialSpace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSpace?.name]);

  useEffect(() => {
    if (!autoSync || !space) return;
    const id = window.setInterval(() => {
      syncLiveRoomData(space);
    }, 15000);
    return () => window.clearInterval(id);
  }, [autoSync, space, syncLiveRoomData]);

  const handleConnectRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    setConnecting(true);
    setRoomError(null);
    try {
      const fetched = await getSpace(roomInput);
      setSpace(fetched);
      onSpaceUpdated(fetched);
      await syncLiveRoomData(fetched);
    } catch (err) {
      if (err instanceof MeetApiError && err.isAuthError) {
        onAuthExpired();
        return;
      }
      setRoomError(
        err instanceof Error
          ? err.message
          : 'Could not connect Companion Mode to that Google Meet room.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleStartScreenPreview = async () => {
    setScreenError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setScreenError('Screen capture preview is not supported in this browser.');
      return;
    }

    stopScreenPreview();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      displayStreamRef.current = stream;
      setScreenSharing(true);
      setStageTab('screen');

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.addEventListener('ended', () => {
          stopScreenPreview();
        });
      }

      window.requestAnimationFrame(() => {
        if (displayVideoRef.current) {
          displayVideoRef.current.srcObject = stream;
          displayVideoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setScreenError('Screen selection was cancelled.');
      } else {
        setScreenError(
          err instanceof Error
            ? err.message
            : 'Unable to capture screen for companion preview.'
        );
      }
    }
  };

  const participantMap = useMemo(() => {
    const map = new Map<string, Participant>();
    participants.forEach((p) => map.set(p.name, p));
    return map;
  }, [participants]);

  const activeParticipants = useMemo(
    () => participants.filter((p) => !p.latestEndTime),
    [participants]
  );

  const departedParticipants = useMemo(
    () => participants.filter((p) => Boolean(p.latestEndTime)),
    [participants]
  );

  const handleToggleHostRestriction = (
    field: 'chatRestriction' | 'presentRestriction' | 'reactionRestriction',
    label: string
  ) => {
    if (!space) return;
    const currentModeration = space.config?.moderation;
    const currentValue = space.config?.moderationRestrictions?.[field];
    const nextValue =
      currentValue === 'HOSTS_ONLY' ? 'NO_RESTRICTION' : 'HOSTS_ONLY';

    const nextConfig: SpaceConfig = {
      moderation: 'ON',
      moderationRestrictions: {
        ...space.config?.moderationRestrictions,
        [field]: nextValue,
      },
    };

    const masks = [`config.moderationRestrictions.${field}`];
    const details = [
      `${label}: ${currentValue ?? 'NO_RESTRICTION'} -> ${nextValue}`,
    ];
    if (currentModeration !== 'ON') {
      masks.unshift('config.moderation');
      details.unshift(`Host moderation: ${currentModeration ?? 'OFF'} -> ON`);
    }

    onRequestConfirm({
      title: `Update ${label.toLowerCase()} in ${space.meetingCode}?`,
      description:
        'This updates live participant permissions for everyone in the connected Google Meet room.',
      affectedDetails: details,
      confirmLabel: 'Apply Permission',
      tone: 'primary',
      onConfirm: async () => {
        try {
          const updated = await patchSpace(
            space.name,
            nextConfig,
            masks.join(',')
          );
          setSpace(updated);
          onSpaceUpdated(updated);
        } catch (err) {
          if (err instanceof MeetApiError && err.isAuthError) {
            onAuthExpired();
            return;
          }
          setRoomError(
            err instanceof Error ? err.message : 'Unable to update room permission.'
          );
        }
      },
    });
  };

  const handleEndConference = () => {
    if (!space) return;
    onRequestConfirm({
      title: `End active conference in ${space.meetingCode}?`,
      description:
        'All participants on primary room hardware and laptops will be disconnected immediately.',
      affectedDetails: [
        `Space: ${space.name}`,
        `Active conference: ${space.activeConference?.conferenceRecord ?? 'Active'}`,
      ],
      confirmLabel: 'End Call for All',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await endActiveConference(space.name);
          await syncLiveRoomData(space);
        } catch (err) {
          if (err instanceof MeetApiError && err.isAuthError) {
            onAuthExpired();
            return;
          }
          setRoomError(
            err instanceof Error ? err.message : 'Unable to end active conference.'
          );
        }
      },
    });
  };

  const handleAddActionItem = (e: React.FormEvent) => {
    e.preventDefault();
    const task = taskInput.trim();
    if (!task) return;
    setActionItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        task,
        owner: ownerInput.trim() || 'Unassigned',
        done: false,
      },
    ]);
    setTaskInput('');
    setOwnerInput('');
  };

  const buildCompanionMarkdown = () => {
    const lines = [
      `# Companion Notes${space ? ` — ${space.meetingCode}` : ''}`,
      space ? `Room link: ${space.meetingUri}` : '',
      '',
    ].filter((l) => l !== '');

    if (actionItems.length > 0) {
      lines.push('', '## Action Items');
      actionItems.forEach((item) => {
        lines.push(
          `- [${item.done ? 'x' : ' '}] ${item.task} (Owner: ${item.owner})`
        );
      });
    }

    if (notes.trim()) {
      lines.push('', '## Notes', notes.trim());
    }

    return lines.join('\n');
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildCompanionMarkdown());
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadNotes = () => {
    const md = buildCompanionMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `companion-notes-${space?.meetingCode ?? 'session'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Echo-Safe Companion Guard + Room Linker */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <VolumeX className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Echo-Safe Second-Screen Mode
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Local microphone and speaker output stay muted on this device so room
                audio never echoes. Use this console alongside in-room hardware or an
                active Meet tab.
              </p>
            </div>
          </div>

          {space && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAutoSync((v) => !v)}
                aria-pressed={autoSync}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  autoSync
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncingData ? 'animate-spin' : ''}`}
                />
                {autoSync ? 'Auto-sync 15s On' : 'Auto-sync Off'}
              </button>

              <button
                type="button"
                onClick={() => syncLiveRoomData(space)}
                disabled={syncingData}
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Sync Now
              </button>

              <a
                href={space.meetingUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Google Meet
              </a>
            </div>
          )}
        </div>

        <form
          onSubmit={handleConnectRoom}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="Connect Companion Mode to a Meet code or URL (e.g. abc-defg-hij)"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {sessionSpaces.length > 0 && (
            <select
              aria-label="Select a session room"
              value={space?.meetingCode ?? ''}
              onChange={(e) => {
                const match = sessionSpaces.find(
                  (s) => s.meetingCode === e.target.value
                );
                if (match) {
                  setRoomInput(match.meetingCode);
                  setSpace(match);
                  syncLiveRoomData(match);
                }
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="" disabled>
                Session rooms...
              </option>
              {sessionSpaces.map((sp) => (
                <option key={sp.name} value={sp.meetingCode}>
                  {sp.meetingCode}
                </option>
              ))}
            </select>
          )}

          <button
            type="submit"
            disabled={connecting || !roomInput.trim()}
            className="whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {connecting ? 'Connecting...' : 'Connect Room'}
          </button>
        </form>

        {space && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {space.meetingCode}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatAccessTypeLabel(space.config?.accessType)}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                space.activeConference
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : ''
              }
            >
              {space.activeConference
                ? 'Active conference detected'
                : 'No active call in room yet'}
            </span>
            {lastSyncedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Synced {lastSyncedAt}
                </span>
              </>
            )}
          </div>
        )}

        {roomError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
          >
            {roomError}
          </div>
        )}
      </section>

      {/* Main 2-column Companion Console */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Live Room Feed / Second-Screen Stage & Host Controls */}
        <section className="xl:col-span-7 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setStageTab('room')}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    stageTab === 'room'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Live Roster &amp; Captions
                </button>
                <button
                  type="button"
                  onClick={() => setStageTab('screen')}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    stageTab === 'screen'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Presentation Stage
                </button>
              </div>

              <div className="flex items-center gap-2">
                {screenSharing ? (
                  <button
                    type="button"
                    onClick={stopScreenPreview}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
                  >
                    <MonitorOff className="h-3.5 w-3.5" />
                    Stop Preview
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartScreenPreview}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Stage Screen Preview
                  </button>
                )}
              </div>
            </div>

            {stageTab === 'screen' ? (
              <div className="mt-4 space-y-3">
                <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-slate-800">
                  {screenSharing ? (
                    <video
                      ref={displayVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
                      <Monitor className="h-9 w-9 text-slate-500" />
                      <p className="mt-3 text-sm font-medium text-slate-200">
                        Stage a window or slide deck locally
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-slate-400">
                        Verify exact framing and aspect ratio on your companion screen
                        before sharing into the Google Meet call.
                      </p>
                      <button
                        type="button"
                        onClick={handleStartScreenPreview}
                        className="mt-4 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        Select Screen or Window
                      </button>
                    </div>
                  )}
                </div>

                {screenError && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {screenError}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                {!space ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
                    <Users className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                      Connect a Google Meet room above
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Once connected, active participants, live transcript lines, and
                      quick host moderation controls appear here.
                    </p>
                  </div>
                ) : !space.activeConference ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
                    <Clock className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                      Waiting for conference to start in {space.meetingCode}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Open Google Meet on your primary device or turn on Auto-sync to
                      detect when participants join.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          Participants ({activeParticipants.length} active ·{' '}
                          {departedParticipants.length} left)
                        </h3>
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {space.activeConference.conferenceRecord?.split('/').pop()}
                        </span>
                      </div>

                      {participants.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                          No participant records returned yet. Click Sync Now to refresh.
                        </p>
                      ) : (
                        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                          {participants.map((p) => {
                            const inCall = !p.latestEndTime;
                            return (
                              <li
                                key={p.name}
                                className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                                    {getParticipantDisplayName(p)}
                                  </p>
                                  <p className="text-slate-500 dark:text-slate-400">
                                    {getParticipantTypeLabel(p)}
                                  </p>
                                </div>
                                <div className="text-right font-mono tabular-nums">
                                  <span
                                    className={
                                      inCall
                                        ? 'font-medium text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }
                                  >
                                    {inCall
                                      ? 'In room'
                                      : `Left ${formatTimeOnly(p.latestEndTime)}`}
                                  </span>
                                  {p.earliestStartTime && (
                                    <p className="text-slate-400">
                                      Joined {formatTimeOnly(p.earliestStartTime)} (
                                      {formatDuration(
                                        p.earliestStartTime,
                                        p.latestEndTime
                                      )}
                                      )
                                    </p>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          Live Transcript Feed ({transcriptEntries.length})
                        </h3>
                      </div>
                      {transcriptEntries.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Transcript entries appear here when meeting transcription is
                          active in Google Meet.
                        </p>
                      ) : (
                        <div className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 px-4 dark:divide-slate-800 dark:border-slate-800">
                          {transcriptEntries.slice(-20).map((entry) => {
                            const speaker = entry.participant
                              ? getParticipantDisplayName(
                                  participantMap.get(entry.participant)
                                )
                              : 'Speaker';
                            return (
                              <div key={entry.name} className="py-2.5">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {speaker}
                                  </span>
                                  <span className="font-mono tabular-nums text-slate-400">
                                    {formatTimeOnly(entry.startTime)}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                                  {entry.text}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Quick Host Controls Card */}
          {space && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Companion Host Controls
                  </h3>
                </div>
                {space.activeConference && (
                  <button
                    type="button"
                    onClick={handleEndConference}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    End Call for All
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    handleToggleHostRestriction('chatRestriction', 'Chat Messages')
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/70 dark:hover:bg-slate-800"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Chat
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {space.config?.moderation === 'ON' &&
                    space.config?.moderationRestrictions?.chatRestriction ===
                      'HOSTS_ONLY'
                      ? 'Hosts only'
                      : 'Everyone'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleToggleHostRestriction('presentRestriction', 'Screen Sharing')
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/70 dark:hover:bg-slate-800"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Screen Share
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {space.config?.moderation === 'ON' &&
                    space.config?.moderationRestrictions?.presentRestriction ===
                      'HOSTS_ONLY'
                      ? 'Hosts only'
                      : 'Everyone'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleToggleHostRestriction('reactionRestriction', 'Reactions')
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/70 dark:hover:bg-slate-800"
                >
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Reactions
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {space.config?.moderation === 'ON' &&
                    space.config?.moderationRestrictions?.reactionRestriction ===
                      'HOSTS_ONLY'
                      ? 'Hosts only'
                      : 'Everyone'}
                  </p>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right: Companion Timekeeper, Action Items & Notes */}
        <section className="xl:col-span-5 space-y-6">
          {/* Timekeeper */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Companion Timekeeper
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Keep room discussions on schedule
                </p>
              </div>
              <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatTimer(timerSeconds)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {[15, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setTimerRunning(false);
                      setTimerPresetMin(mins);
                      setTimerSeconds(mins * 60);
                    }}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                      timerPresetMin === mins
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimerRunning((r) => !r)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
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
                    setTimerSeconds(timerPresetMin * 60);
                  }}
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="Reset companion timer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Action Items & Scratchpad */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Action Items &amp; Notes
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {copiedSummary ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedSummary ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadNotes}
                  className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Download className="h-3 w-3" />
                  Export .md
                </button>
              </div>
            </div>

            <form onSubmit={handleAddActionItem} className="mt-4 space-y-2">
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Capture action item..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  placeholder="Owner (optional)"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
            </form>

            {actionItems.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {actionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() =>
                          setActionItems((prev) =>
                            prev.map((a) =>
                              a.id === item.id ? { ...a, done: !a.done } : a
                            )
                          )
                        }
                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                      />
                      <span className="min-w-0 flex-1 text-xs">
                        <span
                          className={
                            item.done
                              ? 'text-slate-400 line-through'
                              : 'text-slate-800 dark:text-slate-200'
                          }
                        >
                          {item.task}
                        </span>
                        <span className="ml-1.5 text-slate-400">
                          · {item.owner}
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setActionItems((prev) =>
                          prev.filter((a) => a.id !== item.id)
                        )
                      }
                      className="rounded p-1 text-slate-400 hover:text-red-600"
                      aria-label={`Remove ${item.task}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4">
              <label
                htmlFor="companion-notes"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Meeting Notes
              </label>
              <textarea
                id="companion-notes"
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jot down decisions, key timestamps, or follow-ups while listening in the room..."
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
