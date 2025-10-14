import { loggerService } from '@logger'
import React, { FC, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

interface MarkdownAudioProps extends Omit<React.AudioHTMLAttributes<HTMLAudioElement>, 'autoplay'> {
  node?: unknown
  autoplay?: string | boolean
}

const logger = loggerService.withContext('MarkdownAudioRenderer')

const AudioContainer = styled.div`
  margin: 8px 0;

  audio {
    width: 100%;
    max-width: 500px;
    height: 40px;
    border-radius: 8px;
    outline: none;

    &::-webkit-media-controls-panel {
      background-color: #f8fafc;
      border-radius: 8px;
    }

    &::-webkit-media-controls-play-button,
    &::-webkit-media-controls-pause-button {
      background-color: #3b82f6;
      border-radius: 50%;
    }

    &::-webkit-media-controls-timeline {
      background-color: #e2e8f0;
      border-radius: 4px;
    }

    &::-webkit-media-controls-current-time-display,
    &::-webkit-media-controls-time-remaining-display {
      font-size: 12px;
      color: #64748b;
    }
  }
`

const ErrorMessage = styled.div`
  color: #ef4444;
  font-size: 14px;
  padding: 8px 12px;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  margin: 8px 0;
`

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'false' || normalized === '0') return false
    if (normalized === 'true' || normalized === '1') return true
    // Presence of the attribute without an explicit false should be treated as true
    return normalized.length === 0 ? true : Boolean(normalized)
  }
  return Boolean(value)
}

const MarkdownAudioRenderer: FC<MarkdownAudioProps> = (props) => {
  const { children, autoplay, autoPlay, loop, hidden, controls, src, ...restProps } = props
  const resolvedAutoPlay = toBoolean(autoPlay ?? autoplay, true)
  const resolvedLoop = toBoolean(loop, false)
  const resolvedHidden = toBoolean(hidden, false)
  const resolvedControls = toBoolean(controls, true) // 默认显示控制器

  const audioRef = useRef<HTMLAudioElement>(null)
  const [error, setError] = useState<string | null>(null)

  const sourcesKey = useMemo(() => {
    const keys: string[] = []
    if (typeof src === 'string') keys.push(src)
    React.Children.forEach(children, (child) => {
      if (React.isValidElement<{ src?: string }>(child) && typeof child.props.src === 'string') {
        keys.push(child.props.src)
      }
    })
    return keys.join('|')
  }, [children, src])

  useEffect(() => {
    const element = audioRef.current
    if (!element || !resolvedAutoPlay) return

    const tryPlay = () => {
      const playPromise = element.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error) => {
          logger.warn('Unable to autoplay audio element from markdown content', error)
          setError('自动播放失败，请手动点击播放')
        })
      }
    }

    if (element.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      tryPlay()
      return
    }

    const handleCanPlay = () => {
      tryPlay()
      element.removeEventListener('canplay', handleCanPlay)
    }

    element.addEventListener('canplay', handleCanPlay)
    return () => element.removeEventListener('canplay', handleCanPlay)
  }, [resolvedAutoPlay, sourcesKey])

  // 添加错误处理
  useEffect(() => {
    const element = audioRef.current
    if (!element) return

    const handleError = () => {
      logger.error('Audio loading error')
      setError('音频加载失败')
    }

    const handleLoadStart = () => {
      setError(null) // 清除之前的错误
    }

    element.addEventListener('error', handleError)
    element.addEventListener('loadstart', handleLoadStart)

    return () => {
      element.removeEventListener('error', handleError)
      element.removeEventListener('loadstart', handleLoadStart)
    }
  }, [src])

  const finalProps: React.AudioHTMLAttributes<HTMLAudioElement> = {
    ...restProps,
    src,
    autoPlay: resolvedAutoPlay,
    loop: resolvedLoop,
    hidden: resolvedHidden,
    controls: resolvedControls
  }

  if (finalProps.preload === undefined) {
    finalProps.preload = 'auto'
  }

  return (
    <AudioContainer>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <audio ref={audioRef} {...finalProps}>
        {children}
      </audio>
    </AudioContainer>
  )
}

export default MarkdownAudioRenderer
