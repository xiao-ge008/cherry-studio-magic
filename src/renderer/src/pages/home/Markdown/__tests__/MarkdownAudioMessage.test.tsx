import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MarkdownAudioMessage from '../MarkdownAudioMessage'

// Mock fetch
global.fetch = vi.fn()

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-audio-url')
global.URL.revokeObjectURL = vi.fn()

// Mock HTMLAudioElement
const mockAudio = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 4,
  duration: 10,
  currentTime: 0,
  muted: false
}

Object.defineProperty(window, 'HTMLAudioElement', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudio)
})

describe('MarkdownAudioMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['mock audio data'], { type: 'audio/wav' }))
    })
  })

  it('renders speech message correctly', () => {
    render(
      <MarkdownAudioMessage
        role="speech"
        text="哼，骂人？才不要理你！"
        speaker="苏瑶"
        emo="playful"
        url="http://localhost:9880/"
      />
    )

    expect(screen.getByText('苏瑶')).toBeInTheDocument()
    expect(screen.getByText('playful')).toBeInTheDocument()
    expect(screen.getByText('哼，骂人？才不要理你！')).toBeInTheDocument()
  })

  it('renders action message correctly', () => {
    render(
      <MarkdownAudioMessage
        role="action"
        text="苏瑶转过身去，故意撅起小嘴"
        speaker="旁白"
        emo="flirty"
        url="http://localhost:9880/"
      />
    )

    expect(screen.getByText('旁白')).toBeInTheDocument()
    expect(screen.getByText('flirty')).toBeInTheDocument()
    expect(screen.getByText('苏瑶转过身去，故意撅起小嘴')).toBeInTheDocument()
  })

  it('generates audio when component mounts', async () => {
    render(<MarkdownAudioMessage role="speech" text="测试文本" speaker="测试" url="http://localhost:9880/" />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:9880/'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            Accept: 'audio/wav, audio/mp3, audio/*'
          }
        })
      )
    })
  })

  it('handles TTS API errors gracefully', async () => {
    ;(fetch as any).mockRejectedValue(new Error('Network error'))

    render(<MarkdownAudioMessage role="speech" text="测试文本" url="http://localhost:9880/" />)

    await waitFor(() => {
      expect(screen.getByText(/生成语音失败/)).toBeInTheDocument()
    })
  })

  it('does not render when text is empty', () => {
    const { container } = render(<MarkdownAudioMessage role="speech" text="" url="http://localhost:9880/" />)

    expect(container.firstChild).toBeNull()
  })

  it('plays audio when play button is clicked', async () => {
    render(<MarkdownAudioMessage role="speech" text="测试文本" url="http://localhost:9880/" />)

    // Wait for audio to be generated
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })

    // Get the play button (first button with play icon)
    const buttons = screen.getAllByRole('button')
    const playButton = buttons.find((button) => button.querySelector('svg.lucide-play'))

    expect(playButton).toBeDefined()
    fireEvent.click(playButton!)

    await waitFor(() => {
      expect(mockAudio.play).toHaveBeenCalled()
    })
  })
})
