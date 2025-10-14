/**
 * 持久化音频播放管理器
 * 负责音频播放状态的持久化存储和智能播放逻辑
 */

import { loggerService } from '@logger'
import db from '@renderer/databases'
import {
  AudioPlaybackState,
  AudioPlaybackStatus,
  AudioPlayEvent,
  ConversationAudioQueue,
  PersistentAudioManager
} from '@renderer/types/audioPlayback'
import { v4 as uuidv4 } from 'uuid'

const logger = loggerService.withContext('PersistentAudioManager')

export class PersistentAudioManagerImpl implements PersistentAudioManager {
  private isInitialized = false
  private conversationQueues = new Map<string, ConversationAudioQueue>()

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await db.open()
      this.isInitialized = true
      logger.info('PersistentAudioManager initialized successfully')
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to initialize PersistentAudioManager:', err)
      throw err
    }
  }

  async getConversationQueue(topicId: string): Promise<ConversationAudioQueue | null> {
    await this.ensureInitialized()

    // 先从内存缓存获取
    if (this.conversationQueues.has(topicId)) {
      return this.conversationQueues.get(topicId)!
    }

    // 从数据库获取
    try {
      const queue = await db.conversation_audio_queues.get(topicId)
      if (queue) {
        this.conversationQueues.set(topicId, queue)
        return queue
      }
      return null
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to get conversation queue:', err, { topicId })
      return null
    }
  }

  async addAudioToQueue(
    audioData: Omit<AudioPlaybackState, 'audioId' | 'createdAt' | 'playCount' | 'hasCompletedFirstPlay' | 'playHistory'>
  ): Promise<string> {
    const audioId = uuidv4()
    return this.addAudioToQueueWithId(audioId, audioData)
  }

  async addAudioToQueueWithId(
    audioId: string,
    audioData: Omit<AudioPlaybackState, 'audioId' | 'createdAt' | 'playCount' | 'hasCompletedFirstPlay' | 'playHistory'>
  ): Promise<string> {
    await this.ensureInitialized()

    const now = new Date().toISOString()

    const audioState: AudioPlaybackState = {
      ...audioData,
      audioId,
      createdAt: now,
      playCount: 0,
      hasCompletedFirstPlay: false,
      playHistory: [],
      playbackStatus: AudioPlaybackStatus.UNPLAYED
    }

    try {
      // 保存音频状态到数据库
      await db.audio_playback_states.put(audioState)

      // 更新或创建对话队列
      await this.updateConversationQueue(audioData.topicId, audioState)

      logger.info('Audio added to queue with specific ID:', { audioId, topicId: audioData.topicId })
      return audioId
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to add audio to queue:', err, { audioId })
      throw err
    }
  }

  async updateAudioState(audioId: string, updates: Partial<AudioPlaybackState>): Promise<void> {
    await this.ensureInitialized()

    try {
      const existingState = await db.audio_playback_states.get(audioId)
      if (!existingState) {
        logger.warn('Audio state not found for update:', { audioId })
        return
      }

      const updatedState: AudioPlaybackState = {
        ...existingState,
        ...updates
      }

      await db.audio_playback_states.put(updatedState)

      // 更新对话队列中的状态
      await this.refreshConversationQueue(existingState.topicId)

      logger.debug('Audio state updated:', { audioId, updates })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to update audio state:', err, { audioId, updates })
      throw err
    }
  }

  async recordPlayEvent(audioId: string, event: Omit<AudioPlayEvent, 'timestamp'>): Promise<void> {
    await this.ensureInitialized()

    try {
      const audioState = await db.audio_playback_states.get(audioId)
      if (!audioState) {
        logger.warn('Audio state not found for event recording:', { audioId })
        return
      }

      const playEvent: AudioPlayEvent = {
        ...event,
        timestamp: new Date().toISOString()
      }

      const updatedHistory = [...(audioState.playHistory ?? []), playEvent]
      const updates: Partial<AudioPlaybackState> = {
        playHistory: updatedHistory,
        lastPlayedAt: playEvent.timestamp
      }

      // 根据事件类型更新状态
      switch (event.eventType) {
        case 'play':
          updates.playbackStatus = AudioPlaybackStatus.PLAYING
          updates.playCount = (audioState.playCount ?? 0) + 1
          break
        case 'complete':
          updates.playbackStatus = AudioPlaybackStatus.COMPLETED
          updates.hasCompletedFirstPlay = true
          break
        case 'pause':
          updates.playbackStatus = AudioPlaybackStatus.PAUSED
          break
        case 'stop':
          updates.playbackStatus = AudioPlaybackStatus.STOPPED
          updates.hasCompletedFirstPlay = true // 手动停止也算完成首次播放
          break
        case 'error':
          updates.playbackStatus = AudioPlaybackStatus.ERROR
          break
      }

      await this.updateAudioState(audioId, updates)

      logger.debug('Play event recorded:', { audioId, event: playEvent })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to record play event:', err, { audioId, event })
      throw err
    }
  }

  async getNextAudioToPlay(topicId: string): Promise<AudioPlaybackState | null> {
    await this.ensureInitialized()

    try {
      const audioStates = await db.audio_playback_states
        .where('topicId')
        .equals(topicId)
        .and((state) => state.playbackStatus === AudioPlaybackStatus.UNPLAYED)
        .sortBy('createdAt')

      return audioStates.length > 0 ? audioStates[0] : null
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to get next audio to play:', err, { topicId })
      return null
    }
  }

  async getUnplayedAutoplayAudios(topicId: string): Promise<AudioPlaybackState[]> {
    await this.ensureInitialized()

    try {
      const audioStates = await db.audio_playback_states
        .where('topicId')
        .equals(topicId)
        .and(
          (state) =>
            !!state.autoplay && !state.hasCompletedFirstPlay && state.playbackStatus !== AudioPlaybackStatus.ERROR
        )
        .sortBy('createdAt')

      logger.debug('Found unplayed autoplay audios:', {
        topicId,
        count: audioStates.length,
        audios: audioStates.map((s) => ({
          audioId: s.audioId,
          text: (s.text || '').substring(0, 30),
          hasCompletedFirstPlay: s.hasCompletedFirstPlay
        }))
      })

      return audioStates
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to get unplayed autoplay audios:', err, { topicId })
      return []
    }
  }

  async markAudioAsPlayed(audioId: string, playType: 'auto' | 'manual'): Promise<void> {
    await this.recordPlayEvent(audioId, {
      playType,
      eventType: 'complete'
    })
  }

  async clearConversationQueue(topicId: string): Promise<void> {
    await this.ensureInitialized()

    try {
      // 删除对话的所有音频状态
      await db.audio_playback_states.where('topicId').equals(topicId).delete()

      // 删除对话队列
      await db.conversation_audio_queues.delete(topicId)

      // 清除内存缓存
      this.conversationQueues.delete(topicId)

      logger.info('Conversation queue cleared:', { topicId })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to clear conversation queue:', err, { topicId })
      throw err
    }
  }

  async loadConversationAudioStates(topicId: string): Promise<void> {
    await this.ensureInitialized()

    try {
      const audioStates = await db.audio_playback_states.where('topicId').equals(topicId).sortBy('createdAt')

      const queue = await this.getConversationQueue(topicId)
      if (queue) {
        queue.audioStates = audioStates
        this.conversationQueues.set(topicId, queue)
      }

      logger.debug('Conversation audio states loaded:', { topicId, count: audioStates.length })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to load conversation audio states:', err, { topicId })
      throw err
    }
  }

  async saveAudioStatesToDatabase(topicId: string): Promise<void> {
    await this.ensureInitialized()

    try {
      const queue = this.conversationQueues.get(topicId)
      if (!queue) return

      // 批量保存音频状态
      await db.transaction('rw', [db.audio_playback_states, db.conversation_audio_queues], async () => {
        for (const audioState of queue.audioStates) {
          await db.audio_playback_states.put(audioState)
        }
        await db.conversation_audio_queues.put(queue)
      })

      logger.debug('Audio states saved to database:', { topicId, count: queue.audioStates.length })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to save audio states to database:', err, { topicId })
      throw err
    }
  }

  async executeSmartPlayback(topicId: string, triggeredByManual = false): Promise<void> {
    await this.ensureInitialized()

    try {
      // 如果是手动触发，先检查是否有未播放的autoplay音频
      if (triggeredByManual) {
        const unplayedAutoplayAudios = await this.getUnplayedAutoplayAudios(topicId)
        if (unplayedAutoplayAudios.length > 0) {
          logger.info('Found unplayed autoplay audios after manual trigger:', {
            topicId,
            count: unplayedAutoplayAudios.length
          })
          // 这里会触发播放逻辑，由AudioManager处理
        }
      }

      logger.debug('Smart playback executed:', { topicId, triggeredByManual })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to execute smart playback:', err, { topicId })
      throw err
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }
  }

  private async updateConversationQueue(topicId: string, audioState: AudioPlaybackState): Promise<void> {
    let queue = await this.getConversationQueue(topicId)

    if (!queue) {
      // 创建新的对话队列
      queue = {
        topicId,
        audioStates: [audioState],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        queueStatus: 'active'
      }
    } else {
      // 更新现有队列
      queue.audioStates.push(audioState)
      queue.updatedAt = new Date().toISOString()
    }

    await db.conversation_audio_queues.put(queue)
    this.conversationQueues.set(topicId, queue)
  }

  private async refreshConversationQueue(topicId: string): Promise<void> {
    const audioStates = await db.audio_playback_states.where('topicId').equals(topicId).sortBy('createdAt')

    const queue = await this.getConversationQueue(topicId)
    if (queue) {
      queue.audioStates = audioStates
      queue.updatedAt = new Date().toISOString()
      await db.conversation_audio_queues.put(queue)
      this.conversationQueues.set(topicId, queue)
    }
  }
}

// 导出单例实例
export const persistentAudioManager = new PersistentAudioManagerImpl()
