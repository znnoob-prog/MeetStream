import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  MonitorSmartphone,
  PhoneOff,
  RefreshCw,
  Save,
  Search,
  Shield,
} from 'lucide-react';
import { formatAccessTypeLabel } from '../data/presets';
import {
  endActiveConference,
  getSpace,
  MeetApiError,
  patchSpace,
} from '../services/meetApi';
import {
  AccessType,
  AttendanceReportGenerationType,
  AutoGenerationType,
  DefaultJoinAsViewerType,
  EntryPointAccess,
  Moderation,
  PendingConfirmation,
  RestrictionType,
  Space,
  SpaceConfig,
} from '../types/meet';

interface SpaceInspectorProps {
  initialSpace: Space | null;
  initialQuery?: string;
  onSpaceUpdated: (space: Space) => void;
  onOpenCompanion: (space: Space) => void;
  onRequestConfirm: (confirmation: PendingConfirmation) => void;
  onAuthExpired: () => void;
}

function cloneConfig(cfg?: SpaceConfig): SpaceConfig {
  return {
    accessType: cfg?.accessType ?? 'ACCESS_TYPE_UNSPECIFIED',
    entryPointAccess: cfg?.entryPointAccess ?? 'ENTRY_POINT_ACCESS_UNSPECIFIED',
    moderation: cfg?.moderation ?? 'MODERATION_UNSPECIFIED',
    moderationRestrictions: {
      chatRestriction:
        cfg?.moderationRestrictions?.chatRestriction ?? 'RESTRICTION_TYPE_UNSPECIFIED',
      reactionRestriction:
        cfg?.moderationRestrictions?.reactionRestriction ?? 'RESTRICTION_TYPE_UNSPECIFIED',
      presentRestriction:
        cfg?.moderationRestrictions?.presentRestriction ?? 'RESTRICTION_TYPE_UNSPECIFIED',
      defaultJoinAsViewerType:
        cfg?.moderationRestrictions?.defaultJoinAsViewerType ??
        'DEFAULT_JOIN_AS_VIEWER_TYPE_UNSPECIFIED',
    },
    attendanceReportGenerationType:
      cfg?.attendanceReportGenerationType ??
      'ATTENDANCE_REPORT_GENERATION_TYPE_UNSPECIFIED',
    artifactConfig: {
      recordingConfig: {
        autoRecordingGeneration:
          cfg?.artifactConfig?.recordingConfig?.autoRecordingGeneration ??
          'AUTO_GENERATION_TYPE_UNSPECIFIED',
      },
      transcriptionConfig: {
        autoTranscriptionGeneration:
          cfg?.artifactConfig?.transcriptionConfig?.autoTranscriptionGeneration ??
          'AUTO_GENERATION_TYPE_UNSPECIFIED',
      },
      smartNotesConfig: {
        autoSmartNotesGeneration:
          cfg?.artifactConfig?.smartNotesConfig?.autoSmartNotesGeneration ??
          'AUTO_GENERATION_TYPE_UNSPECIFIED',
      },
    },
  };
}

export function SpaceInspector({
  initialSpace,
  initialQuery = '',
  onSpaceUpdated,
  onOpenCompanion,
  onRequestConfirm,
  onAuthExpired,
}: SpaceInspectorProps) {
  const [lookupInput, setLookupInput] = useState(
    initialSpace?.meetingCode || initialQuery
  );
  const [space, setSpace] = useState<Space | null>(initialSpace);
  const [draft, setDraft] = useState<SpaceConfig>(() =>
    cloneConfig(initialSpace?.config)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);

  const loadSpace = async (query: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const fetched = await getSpace(query);
      setSpace(fetched);
      setDraft(cloneConfig(fetched.config));
      onSpaceUpdated(fetched);
    } catch (err) {
      if (err instanceof MeetApiError && err.isAuthError) {
        onAuthExpired();
        return;
      }
      setError(
        err instanceof Error ? err.message : 'Unable to load Google Meet space.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialSpace) {
      setSpace(initialSpace);
      setDraft(cloneConfig(initialSpace.config));
      setLookupInput(initialSpace.meetingCode);
    }
  }, [initialSpace]);

  useEffect(() => {
    if (initialQuery && initialQuery !== space?.meetingCode) {
      setLookupInput(initialQuery);
      loadSpace(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const diff = useMemo(() => {
    const base = cloneConfig(space?.config);
    const masks: string[] = [];
    const summary: string[] = [];

    if (draft.accessType !== base.accessType && draft.accessType !== 'ACCESS_TYPE_UNSPECIFIED') {
      masks.push('config.accessType');
      summary.push(`Access type: ${base.accessType} -> ${draft.accessType}`);
    }
    if (
      draft.entryPointAccess !== base.entryPointAccess &&
      draft.entryPointAccess !== 'ENTRY_POINT_ACCESS_UNSPECIFIED'
    ) {
      masks.push('config.entryPointAccess');
      summary.push(
        `Entry point access: ${base.entryPointAccess} -> ${draft.entryPointAccess}`
      );
    }
    if (draft.moderation !== base.moderation && draft.moderation !== 'MODERATION_UNSPECIFIED') {
      masks.push('config.moderation');
      summary.push(`Host moderation: ${base.moderation} -> ${draft.moderation}`);
    }

    if (draft.moderation === 'ON') {
      const dMod = draft.moderationRestrictions;
      const bMod = base.moderationRestrictions;
      if (
        dMod?.chatRestriction !== bMod?.chatRestriction &&
        dMod?.chatRestriction !== 'RESTRICTION_TYPE_UNSPECIFIED'
      ) {
        masks.push('config.moderationRestrictions.chatRestriction');
        summary.push(
          `Chat restriction: ${bMod?.chatRestriction} -> ${dMod?.chatRestriction}`
        );
      }
      if (
        dMod?.reactionRestriction !== bMod?.reactionRestriction &&
        dMod?.reactionRestriction !== 'RESTRICTION_TYPE_UNSPECIFIED'
      ) {
        masks.push('config.moderationRestrictions.reactionRestriction');
        summary.push(
          `Reaction restriction: ${bMod?.reactionRestriction} -> ${dMod?.reactionRestriction}`
        );
      }
      if (
        dMod?.presentRestriction !== bMod?.presentRestriction &&
        dMod?.presentRestriction !== 'RESTRICTION_TYPE_UNSPECIFIED'
      ) {
        masks.push('config.moderationRestrictions.presentRestriction');
        summary.push(
          `Present restriction: ${bMod?.presentRestriction} -> ${dMod?.presentRestriction}`
        );
      }
      if (
        dMod?.defaultJoinAsViewerType !== bMod?.defaultJoinAsViewerType &&
        dMod?.defaultJoinAsViewerType !== 'DEFAULT_JOIN_AS_VIEWER_TYPE_UNSPECIFIED'
      ) {
        masks.push('config.moderationRestrictions.defaultJoinAsViewerType');
        summary.push(
          `Join as viewer: ${bMod?.defaultJoinAsViewerType} -> ${dMod?.defaultJoinAsViewerType}`
        );
      }
    }

    if (
      draft.attendanceReportGenerationType !== base.attendanceReportGenerationType &&
      draft.attendanceReportGenerationType !==
        'ATTENDANCE_REPORT_GENERATION_TYPE_UNSPECIFIED'
    ) {
      masks.push('config.attendanceReportGenerationType');
      summary.push(
        `Attendance report: ${base.attendanceReportGenerationType} -> ${draft.attendanceReportGenerationType}`
      );
    }

    const dRec = draft.artifactConfig?.recordingConfig?.autoRecordingGeneration;
    const bRec = base.artifactConfig?.recordingConfig?.autoRecordingGeneration;
    if (dRec !== bRec && dRec !== 'AUTO_GENERATION_TYPE_UNSPECIFIED') {
      masks.push('config.artifactConfig.recordingConfig.autoRecordingGeneration');
      summary.push(`Auto-recording: ${bRec} -> ${dRec}`);
    }

    const dTr = draft.artifactConfig?.transcriptionConfig?.autoTranscriptionGeneration;
    const bTr = base.artifactConfig?.transcriptionConfig?.autoTranscriptionGeneration;
    if (dTr !== bTr && dTr !== 'AUTO_GENERATION_TYPE_UNSPECIFIED') {
      masks.push('config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration');
      summary.push(`Auto-transcription: ${bTr} -> ${dTr}`);
    }

    const dNotes = draft.artifactConfig?.smartNotesConfig?.autoSmartNotesGeneration;
    const bNotes = base.artifactConfig?.smartNotesConfig?.autoSmartNotesGeneration;
    if (dNotes !== bNotes && dNotes !== 'AUTO_GENERATION_TYPE_UNSPECIFIED') {
      masks.push('config.artifactConfig.smartNotesConfig.autoSmartNotesGeneration');
      summary.push(`Auto Gemini notes: ${bNotes} -> ${dNotes}`);
    }

    return { masks, summary };
  }, [draft, space?.config]);

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSpace(lookupInput);
  };

  const handleSaveRequest = () => {
    if (!space || diff.masks.length === 0) return;

    const payload: SpaceConfig = {};
    if (diff.masks.includes('config.accessType')) payload.accessType = draft.accessType;
    if (diff.masks.includes('config.entryPointAccess')) {
      payload.entryPointAccess = draft.entryPointAccess;
    }
    if (diff.masks.includes('config.moderation')) payload.moderation = draft.moderation;
    if (diff.masks.some((m) => m.startsWith('config.moderationRestrictions.'))) {
      payload.moderationRestrictions = { ...draft.moderationRestrictions };
    }
    if (diff.masks.includes('config.attendanceReportGenerationType')) {
      payload.attendanceReportGenerationType = draft.attendanceReportGenerationType;
    }
    if (diff.masks.some((m) => m.startsWith('config.artifactConfig.'))) {
      payload.artifactConfig = {
        ...(diff.masks.includes(
          'config.artifactConfig.recordingConfig.autoRecordingGeneration'
        )
          ? {
              recordingConfig: {
                autoRecordingGeneration:
                  draft.artifactConfig?.recordingConfig?.autoRecordingGeneration,
              },
            }
          : {}),
        ...(diff.masks.includes(
          'config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration'
        )
          ? {
              transcriptionConfig: {
                autoTranscriptionGeneration:
                  draft.artifactConfig?.transcriptionConfig?.autoTranscriptionGeneration,
              },
            }
          : {}),
        ...(diff.masks.includes(
          'config.artifactConfig.smartNotesConfig.autoSmartNotesGeneration'
        )
          ? {
              smartNotesConfig: {
                autoSmartNotesGeneration:
                  draft.artifactConfig?.smartNotesConfig?.autoSmartNotesGeneration,
              },
            }
          : {}),
      };
    }

    onRequestConfirm({
      title: `Update settings for room ${space.meetingCode}?`,
      description:
        'These changes will update live Google Meet policies for this space immediately.',
      affectedDetails: diff.summary,
      confirmLabel: 'Apply Room Changes',
      tone: 'primary',
      onConfirm: async () => {
        setError(null);
        setNotice(null);
        try {
          const updated = await patchSpace(
            space.name,
            payload,
            diff.masks.join(',')
          );
          setSpace(updated);
          setDraft(cloneConfig(updated.config));
          onSpaceUpdated(updated);
          setNotice('Room settings updated in Google Meet.');
        } catch (err) {
          if (err instanceof MeetApiError && err.isAuthError) {
            onAuthExpired();
            return;
          }
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to update Google Meet space settings.'
          );
        }
      },
    });
  };

  const handleEndConferenceRequest = () => {
    if (!space) return;
    onRequestConfirm({
      title: `End active conference in ${space.meetingCode}?`,
      description:
        'All currently connected participants will be disconnected from this Google Meet call immediately.',
      affectedDetails: [
        `Space: ${space.name}`,
        `Meeting URI: ${space.meetingUri}`,
        space.activeConference?.conferenceRecord
          ? `Conference: ${space.activeConference.conferenceRecord}`
          : 'Active conference session',
      ],
      confirmLabel: 'End Active Call',
      tone: 'danger',
      onConfirm: async () => {
        setError(null);
        setNotice(null);
        try {
          await endActiveConference(space.name);
          const refreshed = await getSpace(space.name);
          setSpace(refreshed);
          setDraft(cloneConfig(refreshed.config));
          onSpaceUpdated(refreshed);
          setNotice('Active conference ended.');
        } catch (err) {
          if (err instanceof MeetApiError && err.isAuthError) {
            onAuthExpired();
            return;
          }
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to end the active conference.'
          );
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <form
          onSubmit={handleLookupSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Paste Google Meet URL (https://meet.google.com/abc-defg-hij) or meeting code"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !lookupInput.trim()}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {loading ? 'Loading...' : 'Inspect Room'}
          </button>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
          >
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
            {notice}
          </div>
        )}
      </div>

      {!space ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <Shield className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
            Inspect any Google Meet room
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Enter a Google Meet link or 10-letter meeting code above to view active
            conference state, tune moderation restrictions, or configure auto-recording
            and transcription.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Room Header Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{space.name}</span>
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
                    {space.activeConference ? 'Live call in progress' : 'Room idle'}
                  </span>
                </div>
                <h2 className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {space.meetingCode}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {space.meetingUri}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => loadSpace(space.name)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(space.meetingUri).catch(() => {});
                    setCopiedUri(true);
                    setTimeout(() => setCopiedUri(false), 1600);
                  }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {copiedUri ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedUri ? 'Copied' : 'Copy Link'}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenCompanion(space)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <MonitorSmartphone className="h-3.5 w-3.5" />
                  Companion
                </button>

                <a
                  href={space.meetingUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Meet
                </a>

                {space.activeConference && (
                  <button
                    type="button"
                    onClick={handleEndConferenceRequest}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700"
                  >
                    <PhoneOff className="h-3.5 w-3.5" />
                    End Call for All
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Policy Editor Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Access & Entry */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Access &amp; Entry Controls
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Manage who enters directly versus who must ask to join
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="cfg-access"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Meeting Access Type
                  </label>
                  <select
                    id="cfg-access"
                    value={draft.accessType}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        accessType: e.target.value as AccessType,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="ACCESS_TYPE_UNSPECIFIED">Workspace default</option>
                    <option value="OPEN">OPEN — Anyone with link joins directly</option>
                    <option value="TRUSTED">
                      TRUSTED — Organization &amp; invited guests join
                    </option>
                    <option value="RESTRICTED">
                      RESTRICTED — Invited participants only
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="cfg-entry"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Entry Point Access
                  </label>
                  <select
                    id="cfg-entry"
                    value={draft.entryPointAccess}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        entryPointAccess: e.target.value as EntryPointAccess,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="ENTRY_POINT_ACCESS_UNSPECIFIED">
                      Workspace default
                    </option>
                    <option value="ALL">ALL — Web, mobile, and phone dial-in</option>
                    <option value="CREATOR_APP_ONLY">
                      CREATOR_APP_ONLY — Only entry points owned by creator app
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="cfg-attendance"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Attendance Reporting
                  </label>
                  <select
                    id="cfg-attendance"
                    value={draft.attendanceReportGenerationType}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        attendanceReportGenerationType:
                          e.target.value as AttendanceReportGenerationType,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="ATTENDANCE_REPORT_GENERATION_TYPE_UNSPECIFIED">
                      Workspace default
                    </option>
                    <option value="GENERATE_REPORT">Generate attendance report</option>
                    <option value="DO_NOT_GENERATE">Do not generate report</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Host Moderation & Artifacts */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Host Moderation &amp; Smart Artifacts
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Control participant capabilities and automated meeting artifacts
              </p>

              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="cfg-mod"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Host Moderation Mode
                  </label>
                  <select
                    id="cfg-mod"
                    value={draft.moderation}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        moderation: e.target.value as Moderation,
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="MODERATION_UNSPECIFIED">Workspace default</option>
                    <option value="OFF">OFF — Standard unmoderated room</option>
                    <option value="ON">ON — Enable granular host restrictions</option>
                  </select>
                </div>

                {draft.moderation === 'ON' && (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-950/60">
                    <div>
                      <label
                        htmlFor="cfg-chat"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                      >
                        Chat Messages
                      </label>
                      <select
                        id="cfg-chat"
                        value={draft.moderationRestrictions?.chatRestriction}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            moderationRestrictions: {
                              ...d.moderationRestrictions,
                              chatRestriction: e.target.value as RestrictionType,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="RESTRICTION_TYPE_UNSPECIFIED">Default</option>
                        <option value="NO_RESTRICTION">Everyone</option>
                        <option value="HOSTS_ONLY">Hosts only</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="cfg-present"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                      >
                        Screen Sharing
                      </label>
                      <select
                        id="cfg-present"
                        value={draft.moderationRestrictions?.presentRestriction}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            moderationRestrictions: {
                              ...d.moderationRestrictions,
                              presentRestriction: e.target.value as RestrictionType,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="RESTRICTION_TYPE_UNSPECIFIED">Default</option>
                        <option value="NO_RESTRICTION">Everyone</option>
                        <option value="HOSTS_ONLY">Hosts only</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="cfg-react"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                      >
                        Reactions
                      </label>
                      <select
                        id="cfg-react"
                        value={draft.moderationRestrictions?.reactionRestriction}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            moderationRestrictions: {
                              ...d.moderationRestrictions,
                              reactionRestriction: e.target.value as RestrictionType,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="RESTRICTION_TYPE_UNSPECIFIED">Default</option>
                        <option value="NO_RESTRICTION">Everyone</option>
                        <option value="HOSTS_ONLY">Hosts only</option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="cfg-viewer"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                      >
                        Default Join Role
                      </label>
                      <select
                        id="cfg-viewer"
                        value={draft.moderationRestrictions?.defaultJoinAsViewerType}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            moderationRestrictions: {
                              ...d.moderationRestrictions,
                              defaultJoinAsViewerType:
                                e.target.value as DefaultJoinAsViewerType,
                            },
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="DEFAULT_JOIN_AS_VIEWER_TYPE_UNSPECIFIED">
                          Default
                        </option>
                        <option value="OFF">Contributor</option>
                        <option value="ON">Viewer (listen-only)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="cfg-rec"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Auto Recording
                    </label>
                    <select
                      id="cfg-rec"
                      value={
                        draft.artifactConfig?.recordingConfig?.autoRecordingGeneration
                      }
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          artifactConfig: {
                            ...d.artifactConfig,
                            recordingConfig: {
                              autoRecordingGeneration:
                                e.target.value as AutoGenerationType,
                            },
                          },
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="AUTO_GENERATION_TYPE_UNSPECIFIED">Default</option>
                      <option value="ON">Enabled</option>
                      <option value="OFF">Disabled</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="cfg-trans"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Auto Transcript
                    </label>
                    <select
                      id="cfg-trans"
                      value={
                        draft.artifactConfig?.transcriptionConfig
                          ?.autoTranscriptionGeneration
                      }
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          artifactConfig: {
                            ...d.artifactConfig,
                            transcriptionConfig: {
                              autoTranscriptionGeneration:
                                e.target.value as AutoGenerationType,
                            },
                          },
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="AUTO_GENERATION_TYPE_UNSPECIFIED">Default</option>
                      <option value="ON">Enabled</option>
                      <option value="OFF">Disabled</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="cfg-notes"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      Smart Notes
                    </label>
                    <select
                      id="cfg-notes"
                      value={
                        draft.artifactConfig?.smartNotesConfig?.autoSmartNotesGeneration
                      }
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          artifactConfig: {
                            ...d.artifactConfig,
                            smartNotesConfig: {
                              autoSmartNotesGeneration:
                                e.target.value as AutoGenerationType,
                            },
                          },
                        }))
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="AUTO_GENERATION_TYPE_UNSPECIFIED">Default</option>
                      <option value="ON">Enabled</option>
                      <option value="OFF">Disabled</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {diff.masks.length === 0
                ? 'No unsaved changes to room policy.'
                : `${diff.masks.length} pending field update${
                    diff.masks.length === 1 ? '' : 's'
                  } ready to review and confirm.`}
            </p>
            <div className="flex items-center gap-3">
              {diff.masks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraft(cloneConfig(space.config))}
                  className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveRequest}
                disabled={diff.masks.length === 0}
                className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Review &amp; Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
