import {
  AccessType,
  ConferenceRecord,
  Participant,
  RoomPreset,
  Space,
} from '../types/meet';

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: 'trusted-sync',
    name: 'Trusted Team Room',
    subtitle: 'Workspace members join directly',
    summary: 'Guests knock to enter · Open chat & screen sharing',
    config: {
      accessType: 'TRUSTED',
      entryPointAccess: 'ALL',
      moderation: 'OFF',
    },
  },
  {
    id: 'open-collab',
    name: 'Open Collaboration',
    subtitle: 'Frictionless external access',
    summary: 'Anyone with link enters · Open moderation',
    config: {
      accessType: 'OPEN',
      entryPointAccess: 'ALL',
      moderation: 'OFF',
    },
  },
  {
    id: 'executive-brief',
    name: 'Moderated Executive Brief',
    subtitle: 'Restricted invitees & host controls',
    summary: 'Invitees only · Host-controlled screen share & chat',
    config: {
      accessType: 'RESTRICTED',
      entryPointAccess: 'ALL',
      moderation: 'ON',
      moderationRestrictions: {
        chatRestriction: 'NO_RESTRICTION',
        reactionRestriction: 'NO_RESTRICTION',
        presentRestriction: 'HOSTS_ONLY',
        defaultJoinAsViewerType: 'OFF',
      },
    },
  },
  {
    id: 'broadcast-stage',
    name: 'All-Hands Broadcast',
    subtitle: 'View-only attendees by default',
    summary: 'Trusted org access · Attendees join as viewers',
    config: {
      accessType: 'TRUSTED',
      entryPointAccess: 'ALL',
      moderation: 'ON',
      moderationRestrictions: {
        chatRestriction: 'NO_RESTRICTION',
        reactionRestriction: 'NO_RESTRICTION',
        presentRestriction: 'HOSTS_ONLY',
        defaultJoinAsViewerType: 'ON',
      },
    },
  },
];

export function formatAccessTypeLabel(accessType?: AccessType): string {
  switch (accessType) {
    case 'OPEN':
      return 'Open access';
    case 'TRUSTED':
      return 'Trusted workspace';
    case 'RESTRICTED':
      return 'Restricted (invitees)';
    default:
      return 'Workspace default';
  }
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatTimeOnly(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatDuration(startIso?: string, endIso?: string): string {
  if (!startIso) return '—';
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';

  const totalSec = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

export function getParticipantDisplayName(participant?: Participant): string {
  if (!participant) return 'Unknown participant';
  if (participant.signedinUser?.displayName) {
    return participant.signedinUser.displayName;
  }
  if (participant.anonymousUser?.displayName) {
    return `${participant.anonymousUser.displayName} (Guest)`;
  }
  if (participant.phoneUser?.displayName) {
    return `${participant.phoneUser.displayName} (Phone)`;
  }
  return participant.name.split('/').pop() ?? 'Participant';
}

export function getParticipantTypeLabel(participant: Participant): string {
  if (participant.signedinUser) return 'Google Account';
  if (participant.anonymousUser) return 'Guest';
  if (participant.phoneUser) return 'Phone Dial-in';
  return 'Participant';
}

export function extractSpaceCode(spaceResource: string): string {
  return spaceResource.replace(/^spaces\//, '');
}

export function buildInviteText(
  space: Space,
  title?: string,
  agendaItems?: string[]
): string {
  const lines: string[] = [];
  if (title?.trim()) {
    lines.push(title.trim());
    lines.push('');
  }
  lines.push(`Join Google Meet: ${space.meetingUri}`);
  lines.push(`Meeting code: ${space.meetingCode}`);
  if (space.config?.accessType) {
    lines.push(`Access policy: ${formatAccessTypeLabel(space.config.accessType)}`);
  }
  const cleanAgenda = (agendaItems ?? []).map((item) => item.trim()).filter(Boolean);
  if (cleanAgenda.length > 0) {
    lines.push('');
    lines.push('Agenda:');
    cleanAgenda.forEach((item, idx) => {
      lines.push(`${idx + 1}. ${item}`);
    });
  }
  return lines.join('\n');
}

export function sortConferenceRecordsDesc(
  records: ConferenceRecord[]
): ConferenceRecord[] {
  return [...records].sort((a, b) => {
    const tA = new Date(a.startTime).getTime();
    const tB = new Date(b.startTime).getTime();
    return tB - tA;
  });
}
