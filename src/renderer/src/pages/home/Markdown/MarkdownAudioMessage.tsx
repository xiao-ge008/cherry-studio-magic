import { Button, Tooltip } from '@heroui/react'
import { loggerService } from '@logger'
import { Pause, Play, AlertCircle } from 'lucide-react'
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { simpleAudioManager } from '../../../utils/SimpleAudioManager'
import { useAppSelector } from '@renderer/store'

const logger = loggerService.withContext('MarkdownAudioMessage')

// 全局音频缓存 - 避免重复生成相同内容的音频
const audioCache = new Map<string, string>() // key: cacheKey, value: audioUrl
const MAX_CACHE_SIZE = 50 // 最大缓存数量

// 生成缓存键
const generateCacheKey = (text: string, speaker: string, emo: string, url: string): string => {
  return `${url}|${speaker}|${emo}|${text}`
}

// 清理缓存 - LRU策略
const cleanupCache = () => {
  if (audioCache.size > MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(audioCache.keys()).slice(0, audioCache.size - MAX_CACHE_SIZE)
    keysToDelete.forEach((key) => {
      const url = audioCache.get(key)
      if (url && url.startsWith('data:')) {
        // Data URL不需要手动释放
      }
      audioCache.delete(key)
    })
    logger.info('Cache cleaned up', { deletedCount: keysToDelete.length, remainingSize: audioCache.size })
  }
}

interface MarkdownAudioMessageProps {
  role?: 'speech' | 'action'
  text?: string
  speaker?: string
  emo?: string
  autoplay?: boolean
  /** Optional override for the TTS service URL (used mainly for tests). */
  url?: string
}

interface AudioState {
  isLoading: boolean
  isPlaying: boolean
  error: string | null
  audioUrl: string | null
  audioBuffer: AudioBuffer | null
}

// 极简的内联容器 - 无背景，与文字完美融合
const MessageContainer = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 2px;
  vertical-align: baseline;
`

// 消息文本 - 纯文本，无特殊样式
const MessageText = styled.span<{ $role: 'speech' | 'action' }>`
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  font-family: inherit;

  ${(props) =>
    props.$role === 'action'
      ? `
    font-style: italic;
    opacity: 0.8;
  `
      : ''}
`

// 音频控制区域 - 紧凑设计
const AudioControls = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
  vertical-align: middle;
`

// 配音角色标签 - 小巧显示
const VoiceLabel = styled.span`
  font-size: 10px;
  color: #6b7280;
  background: #f1f5f9;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
`

// 状态指示器 - 极小显示
const StatusIndicator = styled.span<{ $visible: boolean }>`
  font-size: 9px;
  color: #9ca3af;
  margin-left: 2px;
  opacity: ${(props) => (props.$visible ? 1 : 0)};
  transition: opacity 0.2s ease;
  white-space: nowrap;
`

const MarkdownAudioMessage: FC<MarkdownAudioMessageProps> = ({
  role = 'speech',
  text = '',
  speaker = '',
  emo = '',
  autoplay = true,
  url: overrideUrl
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasRequestedRef = useRef(false) // 使用ref跟踪是否已经请求过，避免重复请求
  const audioIdRef = useRef<string>(`audio-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`) // 唯一ID
  const [audioState, setAudioState] = useState<AudioState>({
    isLoading: false,
    isPlaying: false,
    error: null,
    audioUrl: null,
    audioBuffer: null
  })
  const [isGenerating, setIsGenerating] = useState(false) // 防止重复生成

  // 从组件配置中获取URL
  const componentSettings = useAppSelector((state) => state.settings.componentSettings)
  const globalTtsUrl = useAppSelector((state) => state.settings.ttsServiceUrl)
  const ttsUrl =
    overrideUrl || componentSettings?.components['audio-message']?.url || globalTtsUrl || 'http://localhost:9880/'

  // 调试信息：记录当前使用的URL
  useEffect(() => {
    logger.info('TTS URL updated', { url: ttsUrl, componentSettings: componentSettings?.components['audio-message'] })
  }, [ttsUrl])

  // 生成缓存键 - 基于所有影响音频生成的参数
  const cacheKey = useMemo(() => {
    return generateCacheKey(text, speaker || '', emo || '', ttsUrl)
  }, [text, speaker, emo, ttsUrl])

  // 当关键参数变化时，重置请求状态
  useEffect(() => {
    hasRequestedRef.current = false
    logger.debug('Reset request state due to parameter change', {
      text: text?.substring(0, 30),
      speaker,
      emo,
      url: ttsUrl
    })
  }, [text, speaker, emo, ttsUrl])

  // 移除了复杂的播放状态检查逻辑

  // 生成TTS音频 - 使用后端代理和缓存
  const generateAudio = useCallback(async () => {
    if (!text) {
      setAudioState((prev) => ({ ...prev, error: '缺少文本内容' }))
      return
    }

    if (!ttsUrl) {
      setAudioState((prev) => ({ ...prev, error: '缺少TTS服务URL' }))
      return
    }

    // 防止重复生成 - 双重保护
    if (isGenerating || hasRequestedRef.current) {
      logger.info('Audio generation already in progress or completed, skipping', {
        isGenerating,
        hasRequested: hasRequestedRef.current
      })
      return
    }

    // 标记已经发起请求
    hasRequestedRef.current = true

    // 检查缓存
    const cachedAudioUrl = audioCache.get(cacheKey)
    if (cachedAudioUrl) {
      logger.info('Using cached audio', { cacheKey: cacheKey.substring(0, 100) + '...' })
      hasRequestedRef.current = true // 标记已处理
      setAudioState((prev) => ({
        ...prev,
        isLoading: false,
        audioUrl: cachedAudioUrl,
        audioBuffer: null,
        error: null
      }))
      return
    }

    setIsGenerating(true)
    setAudioState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      logger.info('Generating TTS audio via backend', {
        text: text.substring(0, 50),
        speaker,
        emo,
        url: ttsUrl,
        requestUrl: ttsUrl
      })

      // 通过后端代理调用TTS服务
      const response = await window.api.tts.generateAudio({
        text: text,
        speaker: speaker || 'default',
        emotion: emo || 'neutral',
        url: ttsUrl
      })

      if (!response.success) {
        throw new Error(response.error || '生成语音失败')
      }

      // 优先使用后端返回的本地文件URL
      if (response.audioUrl) {
        logger.info('Using local audio file URL', { audioUrl: response.audioUrl })

        // 存储到缓存
        audioCache.set(cacheKey, response.audioUrl)
        cleanupCache()

        setAudioState((prev) => ({
          ...prev,
          isLoading: false,
          audioUrl: response.audioUrl || null,
          audioBuffer: null,
          error: null
        }))

        setIsGenerating(false)
        return
      }

      if (!response.audioData) {
        throw new Error('未收到音频数据')
      }

      // 将Buffer转换为Blob并创建URL
      // 添加详细的调试信息
      logger.info('TTS response received', {
        hasAudioData: !!response.audioData,
        audioDataType: typeof response.audioData,
        audioDataConstructor: response.audioData?.constructor?.name
      })

      let audioUrl: string

      try {
        // 尝试多种音频格式和处理方式
        let audioData: Uint8Array

        // 确保数据是Uint8Array格式 - 简化处理避免类型错误
        try {
          audioData = new Uint8Array(Object.values(response.audioData as any))
        } catch {
          // 如果上面失败，尝试直接转换
          audioData = new Uint8Array(response.audioData as any)
        }

        // 验证音频数据是否有效（检查WAV文件头）
        const isValidWav =
          audioData.length > 44 &&
          audioData[0] === 0x52 &&
          audioData[1] === 0x49 && // "RI"
          audioData[2] === 0x46 &&
          audioData[3] === 0x46 // "FF"

        logger.info('Audio data analysis', {
          dataLength: audioData.length,
          isValidWav,
          firstBytes: Array.from(audioData.slice(0, 8))
            .map((b) => b.toString(16))
            .join(' ')
        })

        // 使用最合适的MIME类型
        const mimeType = isValidWav ? 'audio/wav' : 'audio/*'

        // 简化处理：直接创建Data URL
        logger.warn('Falling back to buffer processing (audioUrl not provided)')

        let binaryString = ''
        const chunkSize = 8192

        for (let i = 0; i < audioData.length; i += chunkSize) {
          const chunk = audioData.slice(i, i + chunkSize)
          binaryString += String.fromCharCode.apply(null, Array.from(chunk))
        }

        const base64Audio = btoa(binaryString)
        audioUrl = `data:${mimeType};base64,${base64Audio}`

        logger.info('Data URL created from buffer', {
          dataLength: audioData.length,
          urlLength: audioUrl.length
        })

        // 存储到缓存
        audioCache.set(cacheKey, audioUrl)
        cleanupCache() // 清理过期缓存
        logger.info('Audio cached successfully', {
          cacheKey: cacheKey.substring(0, 100) + '...',
          cacheSize: audioCache.size
        })

        setAudioState((prev) => ({
          ...prev,
          isLoading: false,
          audioUrl,
          audioBuffer: null,
          error: null
        }))
      } catch (blobError) {
        logger.error('Failed to create audio blob', blobError as Error)
        setAudioState((prev) => ({
          ...prev,
          isLoading: false,
          error: `音频数据处理失败: ${(blobError as Error).message}`
        }))
        return
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      logger.error('Failed to generate TTS audio via backend', error as Error, { url: ttsUrl, text: text.substring(0, 50) })

      // 优化错误信息显示
      let userFriendlyError = errorMessage
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        userFriendlyError = `无法连接到TTS服务 (${ttsUrl})，请检查服务是否启动`
      } else if (errorMessage.includes('timeout')) {
        userFriendlyError = `TTS服务响应超时 (${ttsUrl})，请检查服务状态`
      } else if (errorMessage.includes('404')) {
        userFriendlyError = `TTS服务接口不存在 (${ttsUrl})，请检查URL配置`
      }

      setAudioState((prev) => ({
        ...prev,
        isLoading: false,
        error: userFriendlyError
      }))
    } finally {
      setIsGenerating(false)
    }
  }, [text, speaker, emo, ttsUrl]) // 移除cacheKey依赖，避免循环依赖

  // 播放/暂停控制
  const togglePlayback = useCallback(async () => {
    const audioId = audioIdRef.current

    try {
      if (audioState.isPlaying) {
        // 暂停当前音频
        simpleAudioManager.stopAudio(audioId)
        logger.info('Audio paused by user', { audioId })
      } else {
        // 手动播放音频
        const success = await simpleAudioManager.playAudio(audioId, true)
        if (success) {
          logger.info('Audio started by user', { audioId })
        } else {
          throw new Error('播放失败')
        }
      }
    } catch (error) {
      logger.error('Audio playback error', error as Error, { audioId })
      setAudioState((prev) => ({
        ...prev,
        error: `播放失败: ${(error as Error).message}`
      }))
    }
  }, [audioState.isPlaying])

  // 自动生成音频（如果autoplay为true）- 简化条件，只在必要参数变化时触发
  useEffect(() => {
    if (autoplay && text && !hasRequestedRef.current) {
      logger.info('Auto-generating audio', { text: text.substring(0, 50), speaker, emo })
      generateAudio()
    }
  }, [autoplay, text]) // 只依赖核心参数，避免状态循环

  // 注册和注销音频管理器
  useEffect(() => {
    const audioElement = audioRef.current
    if (audioElement && audioState.audioUrl) {
      const audioId = audioIdRef.current

      // 注册到简化的音频管理器
      simpleAudioManager.registerAudio(audioId, audioElement, () => {
        // 音频停止时的回调
        setAudioState((prev) => ({ ...prev, isPlaying: false }))
      })

      logger.info('Audio registered with manager', { audioId })

      // 组件卸载时注销
      return () => {
        simpleAudioManager.unregisterAudio(audioId)
        logger.debug('Audio unregistered from manager', { audioId })
      }
    }

    // 如果没有audioElement，返回空的清理函数
    return () => {}
  }, [audioState.audioUrl]) // 当音频URL变化时重新注册

  // 注意：自动播放逻辑已经移到注册时处理，这里不再需要单独的自动播放useEffect

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => {
      logger.info('Audio started playing')
      setAudioState((prev) => ({ ...prev, isPlaying: true }))
    }

    const handlePause = () => {
      logger.info('Audio paused')
      setAudioState((prev) => ({ ...prev, isPlaying: false }))
    }

    const handleEnded = () => {
      logger.info('Audio playback ended')
      setAudioState((prev) => ({ ...prev, isPlaying: false }))
    }

    const handleError = (e: Event) => {
      const audioElement = e.target as HTMLAudioElement
      const error = audioElement.error

      let errorMessage = '音频播放错误'
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = '音频播放被中止'
            break
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = '网络错误导致音频播放失败'
            break
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = '音频解码错误'
            break
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = '不支持的音频格式'
            break
          default:
            errorMessage = `音频播放错误 (代码: ${error.code})`
        }
      }

      logger.error('Audio playback error', {
        errorCode: error?.code,
        errorMessage: error?.message,
        audioSrc: audioElement.src,
        readyState: audioElement.readyState,
        networkState: audioElement.networkState
      })

      setAudioState((prev) => ({ ...prev, error: errorMessage, isPlaying: false }))
    }

    const handleCanPlay = () => {
      logger.info('Audio can start playing')
    }

    const handleLoadStart = () => {
      logger.info('Audio loading started')
    }

    const handleLoadedData = () => {
      logger.info('Audio data loaded')
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadeddata', handleLoadedData)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('loadeddata', handleLoadedData)
    }
  }, [audioState.audioUrl])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (audioState.audioUrl) {
        URL.revokeObjectURL(audioState.audioUrl)
      }
    }
  }, [audioState.audioUrl])

  // 如果没有文本，不渲染组件
  if (!text) {
    return null
  }

  return (
    <MessageContainer>
      {/* 文本内容 */}
      <MessageText $role={role}>{text}</MessageText>

      {/* 音频控制区域 */}
      <AudioControls>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          color="default"
          onPress={audioState.audioUrl ? togglePlayback : generateAudio}
          isDisabled={audioState.isLoading}
          isLoading={audioState.isLoading}
          className="opacity-60 transition-opacity hover:opacity-100">
          {audioState.isPlaying ? <Pause size={12} /> : <Play size={12} />}
        </Button>

        {/* 配音角色标签 */}
        {speaker && <VoiceLabel>{speaker}</VoiceLabel>}

        {/* 状态指示器 */}
        <StatusIndicator $visible={audioState.isLoading || !!audioState.error}>
          {audioState.isLoading && '生成中'}
          {audioState.error && (
            <Tooltip
              content={
                <div
                  style={{
                    maxWidth: '300px',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                  {audioState.error}
                </div>
              }
              color="danger"
              placement="top"
              showArrow>
              <span
                style={{
                  cursor: 'help',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#dc2626'
                }}>
                <AlertCircle size={14} />
                错误
              </span>
            </Tooltip>
          )}
        </StatusIndicator>
      </AudioControls>

      {/* 隐藏的音频元素 */}
      {audioState.audioUrl && (
        <audio ref={audioRef} src={audioState.audioUrl} preload="metadata" style={{ display: 'none' }} />
      )}
    </MessageContainer>
  )
}

export default MarkdownAudioMessage
