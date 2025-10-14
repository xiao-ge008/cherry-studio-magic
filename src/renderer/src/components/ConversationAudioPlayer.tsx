import { Button } from '@heroui/react'
import { loggerService } from '@logger'
import { Pause, Play } from 'lucide-react'
import { FC, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

const logger = loggerService.withContext('ConversationAudioPlayer')

interface Props {
  topicId: string
}

interface AudioInfo {
  element: HTMLAudioElement
  text: string
  index: number
}

const ConversationAudioPlayer: FC<Props> = ({ topicId }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [audioList, setAudioList] = useState<AudioInfo[]>([])
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)

  // 扫描当前对话中的所有音频元素
  const scanAudioElements = useCallback(() => {
    // 更广泛地搜索音频元素
    const audioElements = document.querySelectorAll('audio')
    const audios: AudioInfo[] = []

    logger.info('Scanning for audio elements...', { totalFound: audioElements.length })

    audioElements.forEach((element, index) => {
      const audioElement = element as HTMLAudioElement
      if (audioElement.src && audioElement.src.trim() !== '') {
        // 尝试从相邻元素获取文本内容
        const container = audioElement.closest('.markdown-audio-message, .audio-message, [class*="audio"]')
        const textContent = container?.textContent?.trim() || `音频 ${index + 1}`

        audios.push({
          element: audioElement,
          text: textContent.substring(0, 50) + (textContent.length > 50 ? '...' : ''),
          index
        })

        logger.info('Found audio element:', {
          index,
          src: audioElement.src.substring(0, 50) + '...',
          text: textContent.substring(0, 30)
        })
      }
    })

    setAudioList(audios)
    logger.info('Audio scan completed:', { count: audios.length, topicId })
  }, [topicId])

  // 播放指定索引的音频
  const playAudioAtIndex = useCallback(
    async (index: number) => {
      if (index >= audioList.length) {
        // 播放完成
        setIsPlaying(false)
        setCurrentIndex(0)
        setCurrentAudio(null)
        logger.info('All audios played')
        return
      }

      const audioInfo = audioList[index]
      const audio = audioInfo.element

      try {
        // 停止当前播放的音频
        if (currentAudio && currentAudio !== audio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }

        setCurrentAudio(audio)
        setCurrentIndex(index)

        // 监听播放结束事件
        const handleEnded = () => {
          audio.removeEventListener('ended', handleEnded)
          // 播放下一个音频
          setTimeout(() => playAudioAtIndex(index + 1), 500)
        }

        audio.addEventListener('ended', handleEnded)

        await audio.play()
        logger.info('Playing audio:', { index, text: audioInfo.text })
      } catch (error) {
        logger.error('Failed to play audio:', error as Error, { index })
        // 跳过这个音频，播放下一个
        setTimeout(() => playAudioAtIndex(index + 1), 100)
      }
    },
    [audioList, currentAudio]
  )

  // 开始播放所有音频
  const startPlayback = useCallback(async () => {
    scanAudioElements()

    // 等待扫描完成
    setTimeout(() => {
      if (audioList.length === 0) {
        logger.warn('No audio elements found')
        return
      }

      setIsPlaying(true)
      setCurrentIndex(0)
      playAudioAtIndex(0)
    }, 100)
  }, [audioList.length, playAudioAtIndex, scanAudioElements])

  // 停止播放
  const stopPlayback = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }

    setIsPlaying(false)
    setCurrentIndex(0)
    setCurrentAudio(null)
    logger.info('Playback stopped')
  }, [currentAudio])

  // 初始扫描
  useEffect(() => {
    scanAudioElements()
  }, [scanAudioElements])

  // 开发环境下总是显示，方便调试
  if (import.meta.env.DEV) {
    return (
      <PlayerContainer>
        {audioList.length > 0 ? (
          <>
            <PlayButton
              size="sm"
              color={isPlaying ? 'danger' : 'primary'}
              variant="flat"
              startContent={isPlaying ? <Pause size={16} /> : <Play size={16} />}
              onClick={isPlaying ? stopPlayback : startPlayback}
              disabled={audioList.length === 0}>
              {isPlaying ? '停止播放' : '播放所有语音'}
            </PlayButton>

            {isPlaying && (
              <StatusText>
                正在播放 {currentIndex + 1}/{audioList.length}
              </StatusText>
            )}

            <AudioCount>共 {audioList.length} 条语音</AudioCount>
          </>
        ) : (
          <div style={{ color: 'var(--color-text-3)', fontSize: '12px' }}>
            未找到音频元素 (调试信息) - topicId: {topicId}
          </div>
        )}
      </PlayerContainer>
    )
  }

  // 生产环境下只在有音频时显示
  if (audioList.length === 0) {
    return null
  }

  return (
    <PlayerContainer>
      <PlayButton
        size="sm"
        color={isPlaying ? 'danger' : 'primary'}
        variant="flat"
        startContent={isPlaying ? <Pause size={16} /> : <Play size={16} />}
        onClick={isPlaying ? stopPlayback : startPlayback}
        disabled={audioList.length === 0}>
        {isPlaying ? '停止播放' : '播放所有语音'}
      </PlayButton>

      {isPlaying && (
        <StatusText>
          正在播放 {currentIndex + 1}/{audioList.length}
        </StatusText>
      )}

      <AudioCount>共 {audioList.length} 条语音</AudioCount>
    </PlayerContainer>
  )
}

const PlayerContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: 8px;
  margin-top: 16px;
  border: 1px solid var(--color-border);
`

const PlayButton = styled(Button)`
  flex-shrink: 0;
`

const StatusText = styled.span`
  font-size: 14px;
  color: var(--color-text-2);
  font-weight: 500;
`

const AudioCount = styled.span`
  font-size: 12px;
  color: var(--color-text-3);
  margin-left: auto;
`

export default ConversationAudioPlayer
