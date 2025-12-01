/**
 * 简化的音频队列管理 - 像聊天记录一样简单
 */

import { loggerService } from '@logger'
import db from '@renderer/databases'
import { v4 as uuidv4 } from 'uuid'

const logger = loggerService.withContext('SimpleAudioQueue')

export interface SimpleAudioItem {
  id: string
  topicId: string
  messageId: string
  text: string
  speaker?: string
  emotion?: string
  ttsUrl: string
  autoplay: boolean
  isPlayed: boolean
  createdAt: string
  playedAt?: string
}

export class SimpleAudioQueue {
  private static instance: SimpleAudioQueue
  private isInitialized = false

  static getInstance(): SimpleAudioQueue {
    if (!SimpleAudioQueue.instance) {
      SimpleAudioQueue.instance = new SimpleAudioQueue()
    }
    return SimpleAudioQueue.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      await db.open()
      this.isInitialized = true
      logger.info('SimpleAudioQueue initialized')
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to initialize SimpleAudioQueue:', err)
      throw error
    }
  }

  /**
   * 添加音频到队列
   */
  async addAudio(audioData: Omit<SimpleAudioItem, 'id' | 'isPlayed' | 'createdAt'>): Promise<string> {
    await this.initialize()

    // 检查是否已存在相同音频
    const existing = await this.findExistingAudio(audioData)
    if (existing) {
      logger.debug('Audio already exists:', { id: existing.id, isPlayed: existing.isPlayed })
      return existing.id
    }

    const audioItem: SimpleAudioItem = {
      ...audioData,
      id: uuidv4(),
      isPlayed: false,
      createdAt: new Date().toISOString()
    }

    try {
      await db.audio_playback_states.put({
        audioId: audioItem.id,
        messageId: audioItem.messageId,
        topicId: audioItem.topicId,
        text: audioItem.text,
        speaker: audioItem.speaker,
        emotion: audioItem.emotion,
        ttsUrl: audioItem.ttsUrl,
        autoplay: audioItem.autoplay,
        hasCompletedFirstPlay: false,
        playbackStatus: 'unplayed',
        createdAt: audioItem.createdAt,
        playCount: 0,
        playHistory: [],
        lastPlayedAt: undefined
      })

      logger.info('Audio added to queue:', { id: audioItem.id, topicId: audioItem.topicId })
      return audioItem.id
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to add audio to queue:', err)
      throw error
    }
  }

  /**
   * 获取对话中未播放的autoplay音频（按顺序）
   */
  async getUnplayedAutoplayAudios(topicId: string): Promise<SimpleAudioItem[]> {
    await this.initialize()

    try {
      const audioStates = await db.audio_playback_states
        .where('topicId')
        .equals(topicId)
        .and((state) => !!state.autoplay && !state.hasCompletedFirstPlay)
        .sortBy('createdAt')

      const result = audioStates.map((state) => ({
        id: state.audioId,
        topicId: state.topicId,
        messageId: state.messageId,
        text: state.text ?? '',
        speaker: state.speaker ?? undefined,
        emotion: state.emotion ?? undefined,
        ttsUrl: state.ttsUrl ?? '',
        autoplay: Boolean(state.autoplay),
        isPlayed: Boolean(state.hasCompletedFirstPlay),
        createdAt: typeof state.createdAt === 'number' ? new Date(state.createdAt).toISOString() : state.createdAt ?? new Date().toISOString(),
        playedAt: state.lastPlayedAt ? String(state.lastPlayedAt) : undefined
      }))

      logger.debug('Found unplayed autoplay audios:', {
        topicId,
        count: result.length,
        ids: result.map((a) => a.id)
      })

      return result
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to get unplayed audios:', err)
      return []
    }
  }

  /**
   * 标记音频为已播放
   */
  async markAsPlayed(audioId: string): Promise<void> {
    await this.initialize()

    try {
      // 先检查记录是否存在
      const existing = await db.audio_playback_states.get(audioId)
      if (!existing) {
        logger.warn('Audio not found in database, cannot mark as played:', { audioId })
        return
      }

      logger.info('Updating audio playback state:', {
        audioId,
        currentState: existing.hasCompletedFirstPlay,
        newState: true
      })

      const updateResult = await db.audio_playback_states.update(audioId, {
        hasCompletedFirstPlay: true,
        playbackStatus: 'completed',
        lastPlayedAt: new Date().toISOString(),
        playCount: (existing.playCount || 0) + 1
      })

      if (updateResult === 0) {
        logger.warn('No rows updated when marking audio as played:', { audioId })
      } else {
        logger.info('Audio marked as played successfully:', { audioId, rowsUpdated: updateResult })
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to mark audio as played:', err, { audioId })
    }
  }

  /**
   * 标记剩余音频为已播放（用户手动停止时）
   */
  async markRemainingAsPlayed(topicId: string): Promise<void> {
    await this.initialize()

    try {
      const unplayedAudios = await this.getUnplayedAutoplayAudios(topicId)

      for (const audio of unplayedAudios) {
        await this.markAsPlayed(audio.id)
      }

      logger.info('Marked remaining audios as played:', {
        topicId,
        count: unplayedAudios.length
      })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to mark remaining audios as played:', err)
    }
  }

  /**
   * 检查音频是否已播放
   */
  async isAudioPlayed(audioData: Omit<SimpleAudioItem, 'id' | 'isPlayed' | 'createdAt'>): Promise<boolean> {
    const existing = await this.findExistingAudio(audioData)
    const isPlayed = existing ? existing.isPlayed : false

    logger.info('Audio played status check:', {
      text: audioData.text.substring(0, 30),
      speaker: audioData.speaker,
      found: !!existing,
      isPlayed,
      audioId: existing?.id
    })

    return isPlayed
  }

  /**
   * 清理对话的音频队列
   */
  async clearQueue(topicId: string): Promise<void> {
    await this.initialize()

    try {
      await db.audio_playback_states.where('topicId').equals(topicId).delete()
      logger.info('Queue cleared:', { topicId })
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to clear queue:', err)
    }
  }

  /**
   * 查找已存在的音频
   */
  private async findExistingAudio(
    audioData: Omit<SimpleAudioItem, 'id' | 'isPlayed' | 'createdAt'>
  ): Promise<SimpleAudioItem | null> {
    try {
      const audioStates = await db.audio_playback_states
        .where('topicId')
        .equals(audioData.topicId)
        .and(
          (state) =>
            state.messageId === audioData.messageId &&
            state.text === audioData.text &&
            state.speaker === audioData.speaker &&
            state.emotion === audioData.emotion
        )
        .toArray()

      if (audioStates.length > 0) {
        const state = audioStates[0]
        return {
          id: state.audioId,
          topicId: state.topicId,
          messageId: state.messageId,
          text: state.text ?? '',
          speaker: state.speaker ?? undefined,
          emotion: state.emotion ?? undefined,
          ttsUrl: state.ttsUrl ?? '',
          autoplay: Boolean(state.autoplay),
          isPlayed: Boolean(state.hasCompletedFirstPlay),
          createdAt: typeof state.createdAt === 'number' ? new Date(state.createdAt).toISOString() : state.createdAt ?? new Date().toISOString(),
          playedAt: state.lastPlayedAt ? String(state.lastPlayedAt) : undefined
        }
      }

      return null
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error))
      logger.error('Failed to find existing audio:', err)
      return null
    }
  }
}

// 导出单例
export const simpleAudioQueue = SimpleAudioQueue.getInstance()
