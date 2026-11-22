export type AccessType = 'ACCESS_TYPE_UNSPECIFIED' | 'OPEN' | 'TRUSTED' | 'RESTRICTED';
export type EntryPointAccess = 'ENTRY_POINT_ACCESS_UNSPECIFIED' | 'ALL' | 'CREATOR_APP_ONLY';
export type Moderation = 'MODERATION_UNSPECIFIED' | 'OFF' | 'ON';
export type RestrictionType = 'RESTRICTION_TYPE_UNSPECIFIED' | 'HOSTS_ONLY' | 'NO_RESTRICTION';
export type DefaultJoinAsViewerType = 'DEFAULT_JOIN_AS_VIEWER_TYPE_UNSPECIFIED' | 'ON' | 'OFF';
export type AttendanceReportGenerationType =
  | 'ATTENDANCE_REPORT_GENERATION_TYPE_UNSPECIFIED'
  | 'GENERATE_REPORT'
  | 'DO_NOT_GENERATE';
export type AutoGenerationType = 'AUTO_GENERATION_TYPE_UNSPECIFIED' | 'ON' | 'OFF';

export interface ModerationRestrictions {
  chatRestriction?: RestrictionType;
  reactionRestriction?: RestrictionType;
  presentRestriction?: RestrictionType;
  defaultJoinAsViewerType?: DefaultJoinAsViewerType;
}

export interface ArtifactConfig {
  recordingConfig?: {
    autoRecordingGeneration?: AutoGenerationType;
  };
  transcriptionConfig?: {
    autoTranscriptionGeneration?: AutoGenerationType;
  };
  smartNotesConfig?: {
    autoSmartNotesGeneration?: AutoGenerationType;
  };
}

export interface SpaceConfig {
  accessType?: AccessType;
  entryPointAccess?: EntryPointAccess;
  moderation?: Moderation;
  moderationRestrictions?: ModerationRestrictions;
  attendanceReportGenerationType?: AttendanceReportGenerationType;
  artifactConfig?: ArtifactConfig;
}

export interface ActiveConference {
  conferenceRecord?: string;
}

export interface Space {
  name: string;
  meetingUri: string;
  meetingCode: string;
  config?: SpaceConfig;
  activeConference?: ActiveConference;
}

export interface ConferenceRecord {
  name: string;
  startTime: string;
  endTime?: string;
  expireTime?: string;
  space: string;
}

export interface SignedinUser {
  user?: string;
  displayName?: string;
}

export interface AnonymousUser {
  displayName?: string;
}

export interface PhoneUser {
  displayName?: string;
}

export interface Participant {
  name: string;
  earliestStartTime?: string;
  latestEndTime?: string;
  signedinUser?: SignedinUser;
  anonymousUser?: AnonymousUser;
  phoneUser?: PhoneUser;
}

export interface ParticipantSession {
  name: string;
  startTime: string;
  endTime?: string;
}

export interface Recording {
  name: string;
  driveDestination?: {
    file?: string;
    exportUri?: string;
  };
  state?: 'STATE_UNSPECIFIED' | 'STARTED' | 'ENDED' | 'FILE_GENERATED';
  startTime?: string;
  endTime?: string;
}

export interface Transcript {
  name: string;
  docsDestination?: {
    document?: string;
    exportUri?: string;
  };
  state?: 'STATE_UNSPECIFIED' | 'STARTED' | 'ENDED' | 'FILE_GENERATED';
  startTime?: string;
  endTime?: string;
}

export interface TranscriptEntry {
  name: string;
  participant?: string;
  text: string;
  languageCode?: string;
  startTime?: string;
  endTime?: string;
}

export interface RoomPreset {
  id: string;
  name: string;
  subtitle: string;
  summary: string;
  config: SpaceConfig;
}

export interface PendingConfirmation {
  title: string;
  description: string;
  affectedDetails: string[];
  confirmLabel: string;
  tone: 'danger' | 'primary';
  onConfirm: () => Promise<void>;
}
