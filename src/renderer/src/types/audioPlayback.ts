export enum AudioPlaybackStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  UNPLAYED = 'unplayed',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  COMPLETED = 'completed',
  ERROR = 'error'
}

export type AudioPlayEvent = {
  eventType: 'play' | 'complete' | 'pause' | 'stop' | 'error'
  playType: 'auto' | 'manual'
  timestamp: string
  error?: string
}

export interface AudioPlaybackState {
  audioId: string
  messageId: string
  topicId: string
  // historical data may be string or number
  createdAt: string | number
  playbackStatus:
    | AudioPlaybackStatus
    | 'idle'
    | 'loading'
    | 'playing'
    | 'paused'
    | 'error'
    | 'completed'
    | 'unplayed'
    | 'stopped'
  // optional fields used by queues
  autoplay?: boolean
  hasCompletedFirstPlay?: boolean
  text?: string
  speaker?: string
  emotion?: string
  ttsUrl?: string
  playCount?: number
  lastPlayedAt?: string | number
  playHistory?: AudioPlayEvent[]
}

export interface ConversationAudioQueue {
  topicId: string
  createdAt: string | number
  updatedAt: string | number
  queueStatus: 'idle' | 'queued' | 'playing' | 'active'
  audioStates: AudioPlaybackState[]
}

export interface PersistentAudioManager {
  initialize(): Promise<void>
  getConversationQueue(topicId: string): Promise<ConversationAudioQueue | null>
  addAudioToQueue(
    audioData: Omit<
      AudioPlaybackState,
      'audioId' | 'createdAt' | 'playCount' | 'hasCompletedFirstPlay' | 'playHistory'
    >
  ): Promise<string>
  addAudioToQueueWithId(
    audioId: string,
    audioData: Omit<
      AudioPlaybackState,
      'audioId' | 'createdAt' | 'playCount' | 'hasCompletedFirstPlay' | 'playHistory'
    >
  ): Promise<string>
  updateAudioState(audioId: string, updates: Partial<AudioPlaybackState>): Promise<void>
  recordPlayEvent(audioId: string, event: Omit<AudioPlayEvent, 'timestamp'>): Promise<void>
  getNextAudioToPlay(topicId: string): Promise<AudioPlaybackState | null>
  getUnplayedAutoplayAudios(topicId: string): Promise<AudioPlaybackState[]>
  markAudioAsPlayed(audioId: string, playType: 'auto' | 'manual'): Promise<void>
  clearConversationQueue(topicId: string): Promise<void>
  loadConversationAudioStates(topicId: string): Promise<void>
  saveAudioStatesToDatabase(topicId: string): Promise<void>
  executeSmartPlayback(topicId: string, triggeredByManual?: boolean): Promise<void>
}
