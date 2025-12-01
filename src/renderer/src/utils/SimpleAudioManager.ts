/**
 * 简化的音频管理器 - 只管理播放，队列交给SimpleAudioQueue
 */

import { loggerService } from '@logger'

const logger = loggerService.withContext('SimpleAudioManager')

interface AudioInstance {
  id: string
  audioElement: HTMLAudioElement
  isPlaying: boolean
  onStop?: () => void
}

class SimpleAudioManager {
  private audioInstances = new Map<string, AudioInstance>()
  private currentPlayingId: string | null = null

  /**
   * 注册音频实例
   */
  registerAudio(id: string, audioElement: HTMLAudioElement, onStop?: () => void): void {
    // 先清理无效实例
    this.cleanupInvalidInstances()

    const instance: AudioInstance = {
      id,
      audioElement,
      isPlaying: false,
      onStop
    }

    this.audioInstances.set(id, instance)

    // 监听音频事件
    audioElement.addEventListener('ended', () => this.handleAudioEnded(id))
    audioElement.addEventListener('pause', () => this.handleAudioPaused(id))
    audioElement.addEventListener('play', () => this.handleAudioStarted(id))

    logger.info('Audio registered:', { id })
  }

  /**
   * 注销音频实例
   */
  unregisterAudio(id: string): void {
    const instance = this.audioInstances.get(id)
    if (instance) {
      this.stopAudio(id)
      this.audioInstances.delete(id)
      logger.debug('Audio unregistered:', { id })
    }
  }

  /**
   * 播放音频
   */
  async playAudio(id: string, isManual = false): Promise<boolean> {
    const instance = this.audioInstances.get(id)
    if (!instance) {
      logger.warn('Audio instance not found:', { id })
      return false
    }

    try {
      // 停止当前播放的音频
      if (this.currentPlayingId && this.currentPlayingId !== id) {
        this.stopAudio(this.currentPlayingId)
      }

      await instance.audioElement.play()
      this.currentPlayingId = id
      instance.isPlaying = true

      logger.info('Audio started playing:', { id, isManual })
      return true
    } catch (error) {
      logger.error('Failed to play audio:', error as Error, { id })
      return false
    }
  }

  /**
   * 停止音频
   */
  stopAudio(id: string): void {
    const instance = this.audioInstances.get(id)
    if (instance && instance.isPlaying) {
      instance.audioElement.pause()
      instance.audioElement.currentTime = 0
      instance.isPlaying = false

      if (this.currentPlayingId === id) {
        this.currentPlayingId = null
      }

      if (instance.onStop) {
        instance.onStop()
      }

      logger.info('Audio stopped:', { id })
    }
  }

  /**
   * 停止所有音频
   */
  stopAll(): void {
    this.audioInstances.forEach((_, id) => this.stopAudio(id))
  }

  // 移除了复杂的队列播放逻辑

  /**
   * 处理音频开始播放
   */
  private handleAudioStarted(id: string): void {
    const instance = this.audioInstances.get(id)
    if (instance) {
      instance.isPlaying = true
      this.currentPlayingId = id
      logger.info('Audio started:', {
        id,
        previousPlayingId: this.currentPlayingId !== id ? 'changed' : 'same',
        totalInstances: this.audioInstances.size
      })
    }
  }

  /**
   * 处理音频暂停
   */
  private handleAudioPaused(id: string): void {
    const instance = this.audioInstances.get(id)
    if (instance) {
      instance.isPlaying = false
      if (this.currentPlayingId === id) {
        this.currentPlayingId = null
      }
      logger.debug('Audio paused:', { id })
    }
  }

  /**
   * 处理音频播放结束
   */
  private handleAudioEnded(id: string): void {
    const instance = this.audioInstances.get(id)
    if (!instance) return

    instance.isPlaying = false
    this.currentPlayingId = null

    // 调用停止回调
    if (instance.onStop) {
      instance.onStop()
    }

    logger.info('Audio ended:', { id })
  }

  // 移除了手动停止的复杂逻辑

  /**
   * 清理无效的音频实例
   */
  private cleanupInvalidInstances(): void {
    const invalidIds: string[] = []

    this.audioInstances.forEach((instance, id) => {
      // 检查音频元素是否还存在于DOM中
      if (!document.contains(instance.audioElement)) {
        invalidIds.push(id)
      }
      // 检查音频元素是否已结束但状态不一致
      else if (instance.audioElement.ended && instance.isPlaying) {
        instance.isPlaying = false
        if (this.currentPlayingId === id) {
          this.currentPlayingId = null
        }
        logger.info('Fixed inconsistent audio state:', { id })
      }
    })

    // 移除无效实例
    invalidIds.forEach((id) => {
      this.audioInstances.delete(id)
      if (this.currentPlayingId === id) {
        this.currentPlayingId = null
      }
      logger.info('Removed invalid audio instance:', { id })
    })

    if (invalidIds.length > 0) {
      logger.info('Cleanup completed:', { removedCount: invalidIds.length })
    }
  }

  /**
   * 获取调试信息
   */
  getDebugInfo() {
    // 先清理无效实例
    this.cleanupInvalidInstances()

    return {
      totalInstances: this.audioInstances.size,
      currentPlayingId: this.currentPlayingId,
      allInstances: Array.from(this.audioInstances.keys()),
      playingInstances: Array.from(this.audioInstances.values())
        .filter((i) => i.isPlaying)
        .map((i) => i.id),
      actuallyPlayingAudios: Array.from(this.audioInstances.values())
        .filter((i) => !i.audioElement.paused && !i.audioElement.ended)
        .map((i) => i.id)
    }
  }
}

// 导出单例
export const simpleAudioManager = new SimpleAudioManager()

// 开发环境下暴露到全局
if (typeof window !== 'undefined') {
  ;(window as any).simpleAudioManager = simpleAudioManager
}
