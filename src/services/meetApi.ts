import {
  ConferenceRecord,
  Participant,
  ParticipantSession,
  Recording,
  Space,
  SpaceConfig,
  Transcript,
  TranscriptEntry,
} from '../types/meet';
import { clearAccessToken, getAccessToken } from './auth';

const MEET_BASE = 'https://meet.googleapis.com/v2';

export class MeetApiError extends Error {
  status: number;
  isAuthError: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MeetApiError';
    this.status = status;
    this.isAuthError = status === 401;
  }
}

export function normalizeSpaceResourceName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Enter a Google Meet link, code, or space ID.');
  }

  if (trimmed.startsWith('spaces/')) {
    return trimmed;
  }

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      const code = segments[0];
      if (!code) {
        throw new Error('Could not find a meeting code in that URL.');
      }
      return `spaces/${code}`;
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('meeting code')) {
      throw err;
    }
  }

  // Strip accidental leading slash or query params
  const cleanCode = trimmed.replace(/^\/+/, '').split('?')[0];
  return `spaces/${cleanCode}`;
}

async function meetFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new MeetApiError('Google Meet session expired. Please sign in again.', 401);
  }

  const res = await fetch(`${MEET_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Google Meet request failed (${res.status})`;
    try {
      const payload = await res.json();
      if (payload?.error?.message) {
        message = payload.error.message;
      }
    } catch {
      // Ignore JSON parse failure
    }
    if (res.status === 401) {
      clearAccessToken();
    }
    throw new MeetApiError(message, res.status);
  }

  if (res.status === 204) {
    return {} as T;
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function createSpace(config?: SpaceConfig): Promise<Space> {
  const body = config ? { config } : {};
  return meetFetch<Space>('/spaces', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getSpace(spaceInput: string): Promise<Space> {
  const resourceName = normalizeSpaceResourceName(spaceInput);
  return meetFetch<Space>(`/${resourceName}`);
}

export async function patchSpace(
  spaceName: string,
  config: SpaceConfig,
  updateMask: string
): Promise<Space> {
  const normalized = normalizeSpaceResourceName(spaceName);
  const query = new URLSearchParams({ updateMask });
  return meetFetch<Space>(`/${normalized}?${query.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify({ config }),
  });
}

export async function endActiveConference(spaceName: string): Promise<void> {
  const normalized = normalizeSpaceResourceName(spaceName);
  await meetFetch<Record<string, never>>(`/${normalized}:endActiveConference`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function listConferenceRecords(
  pageSize = 25,
  pageToken?: string
): Promise<{ conferenceRecords: ConferenceRecord[]; nextPageToken?: string }> {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  if (pageToken) {
    params.set('pageToken', pageToken);
  }
  const data = await meetFetch<{
    conferenceRecords?: ConferenceRecord[];
    nextPageToken?: string;
  }>(`/conferenceRecords?${params.toString()}`);

  return {
    conferenceRecords: data.conferenceRecords ?? [],
    nextPageToken: data.nextPageToken,
  };
}

export async function listParticipants(
  conferenceRecordName: string
): Promise<Participant[]> {
  const data = await meetFetch<{ participants?: Participant[] }>(
    `/${conferenceRecordName}/participants?pageSize=100`
  );
  return data.participants ?? [];
}

export async function listParticipantSessions(
  participantName: string
): Promise<ParticipantSession[]> {
  const data = await meetFetch<{ participantSessions?: ParticipantSession[] }>(
    `/${participantName}/participantSessions?pageSize=50`
  );
  return data.participantSessions ?? [];
}

export async function listRecordings(
  conferenceRecordName: string
): Promise<Recording[]> {
  const data = await meetFetch<{ recordings?: Recording[] }>(
    `/${conferenceRecordName}/recordings?pageSize=50`
  );
  return data.recordings ?? [];
}

export async function listTranscripts(
  conferenceRecordName: string
): Promise<Transcript[]> {
  const data = await meetFetch<{ transcripts?: Transcript[] }>(
    `/${conferenceRecordName}/transcripts?pageSize=50`
  );
  return data.transcripts ?? [];
}

export async function listTranscriptEntries(
  transcriptName: string
): Promise<TranscriptEntry[]> {
  const data = await meetFetch<{ transcriptEntries?: TranscriptEntry[] }>(
    `/${transcriptName}/entries?pageSize=100`
  );
  return data.transcriptEntries ?? [];
}
