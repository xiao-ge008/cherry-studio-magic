export interface OptionsData {
  options: string[]
  keyword?: string
  rawText: string
}

export const OPTION_KEYWORDS = [
  'options',
  'choices',
  'select'
] as const
