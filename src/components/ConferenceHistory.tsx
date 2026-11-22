import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Film,
  History,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import {
  extractSpaceCode,
  formatDateTime,
  formatDuration,
  formatTimeOnly,
  getParticipantDisplayName,
  getParticipantTypeLabel,
  sortConferenceRecordsDesc,
} from '../data/presets';
import {
  listConferenceRecords,
  listParticipants,
  listParticipantSessions,
  listRecordings,
  listTranscriptEntries,
  listTranscripts,
  MeetApiError,
} from '../services/meetApi';
import {
  ConferenceRecord,
  Participant,
  ParticipantSession,
  Recording,
  Transcript,
  TranscriptEntry,
} from '../types/meet';

interface ConferenceHistoryProps {
  onInspectSpaceCode: (spaceName: string) => void;
  onGoToLobby: () => void;
  onAuthExpired: () => void;
}

export function ConferenceHistory({
  onInspectSpaceCode,
  onGoToLobby,
  onAuthExpired,
}: ConferenceHistoryProps) {
  const [records, setRecords] = useState<ConferenceRecord[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  const [selectedRecord, setSelectedRecord] = useState<ConferenceRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [transcriptQuery, setTranscriptQuery] = useState('');
  const [activeDossierTab, setActiveDossierTab] = useState<
    'transcript' | 'participants' | 'recordings'
  >('transcript');

  const [expandedSessions, setExpandedSessions] = useState<
    Record<string, ParticipantSession[]>
  >({});
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  const loadDossier = useCallback(
    async (record: ConferenceRecord) => {
      setSelectedRecord(record);
      setLoadingDetail(true);
      setDetailError(null);
      setParticipants([]);
      setRecordings([]);
      setTranscripts([]);
      setTranscriptEntries([]);
      setExpandedSessions({});

      try {
        const [parts, recs, trans] = await Promise.all([
          listParticipants(record.name),
          listRecordings(record.name),
          listTranscripts(record.name),
        ]);

        setParticipants(parts);
        setRecordings(recs);
        setTranscripts(trans);

        if (trans.length > 0) {
          const entries = await listTranscriptEntries(trans[0].name);
          setTranscriptEntries(entries);
          setActiveDossierTab('transcript');
        } else {
          setActiveDossierTab('participants');
        }
      } catch (err) {
        if (err instanceof MeetApiError && err.isAuthError) {
          onAuthExpired();
          return;
        }
        setDetailError(
          err instanceof Error
            ? err.message
            : 'Unable to load details for this conference.'
        );
      } finally {
        setLoadingDetail(false);
      }
    },
    [onAuthExpired]
  );

  const fetchRecords = useCallback(
    async (reset = true) => {
      if (reset) {
        setLoadingList(true);
        setListError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await listConferenceRecords(
          25,
          reset ? undefined : nextPageToken
        );
        const sorted = sortConferenceRecordsDesc(res.conferenceRecords);
        if (reset) {
          setRecords(sorted);
          if (sorted.length > 0 && !selectedRecord) {
            loadDossier(sorted[0]);
          }
        } else {
          setRecords((prev) => sortConferenceRecordsDesc([...prev, ...sorted]));
        }
        setNextPageToken(res.nextPageToken);
      } catch (err) {
        if (err instanceof MeetApiError && err.isAuthError) {
          onAuthExpired();
          return;
        }
        setListError(
          err instanceof Error
            ? err.message
            : 'Unable to load Google Meet conference history.'
        );
      } finally {
        setLoadingList(false);
        setLoadingMore(false);
      }
    },
    [loadDossier, nextPageToken, onAuthExpired, selectedRecord]
  );

  useEffect(() => {
    fetchRecords(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRecords = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const spaceCode = extractSpaceCode(r.space).toLowerCase();
      const dateStr = formatDateTime(r.startTime).toLowerCase();
      return spaceCode.includes(q) || dateStr.includes(q);
    });
  }, [filterText, records]);

  const participantMap = useMemo(() => {
    const map = new Map<string, Participant>();
    participants.forEach((p) => map.set(p.name, p));
    return map;
  }, [participants]);

  const filteredTranscriptEntries = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return transcriptEntries;
    return transcriptEntries.filter((entry) => {
      const speaker = entry.participant
        ? getParticipantDisplayName(participantMap.get(entry.participant)).toLowerCase()
        : '';
      return entry.text.toLowerCase().includes(q) || speaker.includes(q);
    });
  }, [participantMap, transcriptEntries, transcriptQuery]);

  const handleToggleSessions = async (participant: Participant) => {
    if (expandedSessions[participant.name]) {
      setExpandedSessions((prev) => {
        const next = { ...prev };
        delete next[participant.name];
        return next;
      });
      return;
    }

    setLoadingSessionId(participant.name);
    try {
      const sessions = await listParticipantSessions(participant.name);
      setExpandedSessions((prev) => ({
        ...prev,
        [participant.name]: sessions,
      }));
    } catch {
      // Ignore error
    } finally {
      setLoadingSessionId(null);
    }
  };

  const handleExportTranscript = () => {
    if (!selectedRecord || transcriptEntries.length === 0) return;
    const spaceCode = extractSpaceCode(selectedRecord.space);
    const lines = [
      `# Google Meet Transcript — ${spaceCode}`,
      `Started: ${formatDateTime(selectedRecord.startTime)}`,
      `Duration: ${formatDuration(selectedRecord.startTime, selectedRecord.endTime)}`,
      '',
      ...transcriptEntries.map((entry) => {
        const speaker = entry.participant
          ? getParticipantDisplayName(participantMap.get(entry.participant))
          : 'Speaker';
        const time = formatTimeOnly(entry.startTime);
        return `**${speaker}** (${time}): ${entry.text}`;
      }),
    ];

    const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meet-transcript-${spaceCode}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left pane: Conference List */}
      <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Conference Records
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Recent &amp; active Google Meet sessions
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchRecords(true)}
            disabled={loadingList}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter by meeting code or date..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {listError && (
          <div
            role="alert"
            className="m-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
          >
            {listError}
          </div>
        )}

        {loadingList ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-5 py-4 animate-pulse">
                <div className="h-3.5 w-28 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="mt-2 h-3 w-44 rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <History className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
              No conference records found
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Completed or ongoing Google Meet sessions on your account appear here.
            </p>
            <button
              type="button"
              onClick={onGoToLobby}
              className="mt-4 inline-flex items-center whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              Create New Room
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto dark:divide-slate-800">
            {filteredRecords.map((rec) => {
              const active = selectedRecord?.name === rec.name;
              const code = extractSpaceCode(rec.space);
              const ongoing = !rec.endTime;
              return (
                <button
                  key={rec.name}
                  type="button"
                  onClick={() => loadDossier(rec)}
                  className={`w-full px-5 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    active
                      ? 'bg-blue-50/70 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {code}
                    </span>
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        ongoing
                          ? 'font-medium text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {ongoing
                        ? 'Live now'
                        : formatDuration(rec.startTime, rec.endTime)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums">{formatDateTime(rec.startTime)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ongoing ? 'In progress' : 'Ended'}</span>
                  </div>
                </button>
              );
            })}

            {nextPageToken && (
              <div className="p-4 text-center">
                <button
                  type="button"
                  onClick={() => fetchRecords(false)}
                  disabled={loadingMore}
                  className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {loadingMore ? 'Loading more...' : 'Load Older Conferences'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Right pane: Conference Dossier */}
      <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!selectedRecord ? (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center p-10 text-center">
            <FileText className="h-9 w-9 text-slate-400" />
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Select a conference to inspect
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              View participant join windows, Google Drive recordings, and searchable
              meeting transcripts.
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums">
                      {formatDateTime(selectedRecord.startTime)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatDuration(selectedRecord.startTime, selectedRecord.endTime)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {participants.length} participant
                      {participants.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <h3 className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {extractSpaceCode(selectedRecord.space)}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => onInspectSpaceCode(selectedRecord.space)}
                  className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Open Room Settings
                </button>
              </div>

              {/* Segmented dossier tabs */}
              <div className="mt-4 inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveDossierTab('transcript')}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeDossierTab === 'transcript'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Transcript ({transcriptEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDossierTab('participants')}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeDossierTab === 'participants'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Participants ({participants.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveDossierTab('recordings')}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeDossierTab === 'recordings'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Film className="h-3.5 w-3.5" />
                  Recordings ({recordings.length})
                </button>
              </div>
            </div>

            {detailError && (
              <div
                role="alert"
                className="m-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
              >
                {detailError}
              </div>
            )}

            {loadingDetail ? (
              <div className="space-y-3 p-6 animate-pulse">
                <div className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-16 w-full rounded bg-slate-100 dark:bg-slate-800/70" />
                <div className="h-16 w-full rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
            ) : (
              <div className="flex-1 p-6">
                {activeDossierTab === 'transcript' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={transcriptQuery}
                          onChange={(e) => setTranscriptQuery(e.target.value)}
                          placeholder="Search transcript by keyword or speaker..."
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {transcripts[0]?.docsDestination?.exportUri && (
                          <a
                            href={transcripts[0].docsDestination.exportUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Doc
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={handleExportTranscript}
                          disabled={transcriptEntries.length === 0}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export .md
                        </button>
                      </div>
                    </div>

                    {filteredTranscriptEntries.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {transcriptEntries.length === 0
                            ? 'No transcript was generated for this meeting.'
                            : 'No transcript lines match your search.'}
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto dark:divide-slate-800">
                        {filteredTranscriptEntries.map((entry) => {
                          const speaker = entry.participant
                            ? getParticipantDisplayName(
                                participantMap.get(entry.participant)
                              )
                            : 'Speaker';
                          return (
                            <div key={entry.name} className="py-3">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {speaker}
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                  {formatTimeOnly(entry.startTime)}
                                </span>
                              </div>
                              <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                {entry.text}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeDossierTab === 'participants' && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {participants.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        No participant logs available for this conference.
                      </p>
                    ) : (
                      participants.map((p) => {
                        const sessions = expandedSessions[p.name];
                        const isLoadingSess = loadingSessionId === p.name;
                        return (
                          <div key={p.name} className="py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {getParticipantDisplayName(p)}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                  {getParticipantTypeLabel(p)}
                                  {p.earliestStartTime && (
                                    <>
                                      <span aria-hidden="true"> · </span>
                                      <span className="font-mono tabular-nums">
                                        {formatTimeOnly(p.earliestStartTime)} –{' '}
                                        {p.latestEndTime
                                          ? formatTimeOnly(p.latestEndTime)
                                          : 'Active'}
                                      </span>
                                    </>
                                  )}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleSessions(p)}
                                className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {sessions ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                                {isLoadingSess ? 'Loading...' : 'Sessions'}
                              </button>
                            </div>

                            {sessions && (
                              <ul className="mt-2 ml-3 space-y-1 border-l border-slate-200 pl-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
                                {sessions.map((s) => (
                                  <li key={s.name} className="font-mono tabular-nums">
                                    Joined {formatTimeOnly(s.startTime)} · Left{' '}
                                    {s.endTime ? formatTimeOnly(s.endTime) : 'Still in call'}{' '}
                                    ({formatDuration(s.startTime, s.endTime)})
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {activeDossierTab === 'recordings' && (
                  <div className="space-y-3">
                    {recordings.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          No recordings were saved for this conference.
                        </p>
                      </div>
                    ) : (
                      recordings.map((rec, idx) => (
                        <div
                          key={rec.name}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              Recording #{idx + 1}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-mono tabular-nums">
                                {formatDateTime(rec.startTime)}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span>{rec.state ?? 'READY'}</span>
                            </p>
                          </div>

                          {rec.driveDestination?.exportUri && (
                            <a
                              href={rec.driveDestination.exportUri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View in Drive
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
