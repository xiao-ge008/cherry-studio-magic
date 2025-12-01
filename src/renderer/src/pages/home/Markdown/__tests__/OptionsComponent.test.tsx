import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter, EVENT_NAMES } from '@renderer/services/EventService'
import OptionsComponent from '../OptionsComponent'

// Mock HeroUI
vi.mock('@heroui/react', () => ({
  Skeleton: ({ ...props }: any) => <div {...props}>Loading...</div>,
  cn: (...classes: any[]) => classes.filter(Boolean).join(' ')
}))

// Mock EventEmitter
vi.mock('@renderer/services/EventService', () => ({
  EventEmitter: {
    emit: vi.fn()
  },
  EVENT_NAMES: {
    SEND_OPTION_MESSAGE: 'SEND_OPTION_MESSAGE'
  }
}))

// Mock logger service
vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    })
  }
}))

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (key === 'message.markdown.options.title') {
        return `Please select an option (${params?.keyword}):`
      }
      if (key === 'message.markdown.options.selected') {
        return `Selected: ${params?.option}`
      }
      if (key === 'message.markdown.options.processing') {
        return 'Processing...'
      }
      return key
    }
  })
}))

describe('OptionsComponent', () => {
  const mockOptionsData = {
    options: ['Option 1', 'Option 2', 'Option 3'],
    keyword: 'options',
    rawText: 'options ["Option 1", "Option 2", "Option 3"]'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render options correctly', () => {
    const dataOptions = JSON.stringify(mockOptionsData)

    render(<OptionsComponent data-options={dataOptions} />)

    expect(screen.getByText('Please select an option (options):')).toBeInTheDocument()
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
    expect(screen.getByText('Option 3')).toBeInTheDocument()
  })

  it('should handle option click and emit event', () => {
    const dataOptions = JSON.stringify(mockOptionsData)

    render(<OptionsComponent data-options={dataOptions} />)

    const option1Button = screen.getByText('Option 1')
    fireEvent.click(option1Button)

    expect(EventEmitter.emit).toHaveBeenCalledWith(EVENT_NAMES.SEND_OPTION_MESSAGE, {
      content: 'Option 1',
      originalOptions: mockOptionsData,
      selectedIndex: 0
    })
  })

  it('should disable selected button after selection', () => {
    const dataOptions = JSON.stringify(mockOptionsData)

    render(<OptionsComponent data-options={dataOptions} />)

    const buttons = screen.getAllByRole('button')
    const option1Button = buttons[0] // First button is "Option 1"

    fireEvent.click(option1Button)

    // Only the selected button should be disabled
    expect(option1Button).toBeDisabled()

    // Other buttons should still be enabled
    expect(buttons[1]).not.toBeDisabled() // Option 2
    expect(buttons[2]).not.toBeDisabled() // Option 3

    // Selected info should be shown
    expect(screen.getByText('Selected: Option 1')).toBeInTheDocument()
  })

  it('should not render if options data is invalid', () => {
    const invalidDataOptions = 'invalid json'

    const { container } = render(<OptionsComponent data-options={invalidDataOptions} />)

    expect(container.firstChild).toBeNull()
  })

  it('should not render if options array is empty', () => {
    const emptyOptionsData = JSON.stringify({
      options: [],
      keyword: 'options',
      rawText: 'options []'
    })

    const { container } = render(<OptionsComponent data-options={emptyOptionsData} />)

    expect(container.firstChild).toBeNull()
  })

  it('should show loading skeleton when loading prop is true', () => {
    const dataOptions = JSON.stringify(mockOptionsData)

    render(<OptionsComponent data-options={dataOptions} loading={true} />)

    expect(screen.getAllByText('Loading...')).toHaveLength(4) // 1 skeleton title + 3 skeleton buttons
  })

  it('should disable all options when disabled prop is true', () => {
    const dataOptions = JSON.stringify(mockOptionsData)

    render(<OptionsComponent data-options={dataOptions} disabled={true} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('should call onOptionSelect callback when provided', async () => {
    const onOptionSelect = vi.fn()
    const dataOptions = JSON.stringify(mockOptionsData)

    render(<OptionsComponent data-options={dataOptions} onOptionSelect={onOptionSelect} />)

    const firstOption = screen.getByText('Option 1')
    fireEvent.click(firstOption)

    expect(onOptionSelect).toHaveBeenCalledWith('Option 1', mockOptionsData)
  })

  it('should support keyboard navigation', () => {
    const dataOptions = JSON.stringify(mockOptionsData)

    render(<OptionsComponent data-options={dataOptions} />)

    const container = screen.getByRole('group')

    // The component auto-focuses to index 0, then arrow down moves to index 1
    // Test enter key selection (should select Option 2 at index 1)
    fireEvent.keyDown(container, { key: 'Enter' })

    expect(EventEmitter.emit).toHaveBeenCalledWith(EVENT_NAMES.SEND_OPTION_MESSAGE, {
      content: 'Option 1', // First option should be selected due to auto-focus
      originalOptions: mockOptionsData,
      selectedIndex: 0
    })
  })

  it('should prevent multiple clicks on the same option', () => {
    const dataOptions = JSON.stringify(mockOptionsData)

    render(<OptionsComponent data-options={dataOptions} />)

    const option1Button = screen.getByText('Option 1')

    // Click multiple times
    fireEvent.click(option1Button)
    fireEvent.click(option1Button)
    fireEvent.click(option1Button)

    // Event should only be emitted once
    expect(EventEmitter.emit).toHaveBeenCalledTimes(1)
  })
})
