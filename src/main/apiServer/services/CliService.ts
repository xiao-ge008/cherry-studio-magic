import { spawn } from 'child_process'

import { loggerService } from '../../services/LoggerService'

const logger = loggerService.withContext('CliService')

// Hardcoded model lists (following AIClient-2-API implementation)
// Reference: https://github.com/justlovemaki/AIClient-2-API/blob/main/src/gemini/gemini-core.js#L17
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.5-flash-preview-09-2025',
  'gemini-3-pro-preview'
]
// Qwen OAuth API supported models (matching QwenApiService)
// These are the models available via https://portal.qwen.ai/v1/chat/completions
const QWEN_MODELS = ['qwen3-coder-plus', 'qwen3-coder-flash']

const CLI_MODELS_MAP: Record<string, string[]> = {
  gemini: GEMINI_MODELS,
  qwen: QWEN_MODELS
}

export interface CliOptions {
  command: string
  args: string[]
  input?: string
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export interface CliStreamCallbacks {
  onData: (data: string) => void
  onError: (error: string) => void
  onDone: (code: number | null) => void
}

export class CliService {
  /**
   * Execute a CLI command and return the full stdout output.
   */
  async execute(options: CliOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const { command, args, input, cwd, env } = options

      logger.info(`Executing CLI: ${command} ${args.join(' ')}`)

      const child = spawn(command, args, {
        cwd: cwd || process.cwd(),
        env: { ...process.env, ...env },
        shell: true // Use shell to ensure command is found in PATH
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('error', (error) => {
        logger.error(`CLI execution error: ${error.message}`)
        reject(error)
      })

      child.on('close', (code) => {
        if (code !== 0) {
          logger.warn(`CLI exited with code ${code}. Stderr: ${stderr}`)
          // Some CLIs might output valid JSON even on error, so we could try to parse it.
          // But generally non-zero means failure.
          // For now, if stdout is empty, reject with stderr.
          if (!stdout.trim()) {
            reject(new Error(stderr || `Command exited with code ${code}`))
            return
          }
        }
        resolve(stdout)
      })

      if (input) {
        child.stdin.write(input)
        child.stdin.end()
      }
    })
  }

  /**
   * Execute a CLI command and stream the output.
   */
  stream(options: CliOptions, callbacks: CliStreamCallbacks): void {
    const { command, args, input, cwd, env } = options

    logger.info(`Streaming CLI: ${command} ${args.join(' ')}`)

    const child = spawn(command, args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env, ...env },
      shell: true
    })

    child.stdout.on('data', (data) => {
      callbacks.onData(data.toString())
    })

    child.stderr.on('data', (data) => {
      callbacks.onError(data.toString())
    })

    child.on('error', (error) => {
      logger.error(`CLI stream error: ${error.message}`)
      callbacks.onError(error.message)
    })

    child.on('close', (code) => {
      callbacks.onDone(code)
    })

    if (input) {
      child.stdin.write(input)
      child.stdin.end()
    }
  }
  /**
   * Get list of models from predefined lists
   * Uses hardcoded model lists instead of CLI calls for reliability
   * Reference: https://github.com/justlovemaki/AIClient-2-API
   */
  async getModels(cliName: 'gemini' | 'qwen'): Promise<any[]> {
    logger.info(`Getting models for ${cliName} from predefined list`)

    const models = CLI_MODELS_MAP[cliName] || []

    if (models.length === 0) {
      logger.warn(`No models found for CLI: ${cliName}`)
      return []
    }

    // Format models in OpenAI-compatible format
    const formattedModels = models.map((id) => ({
      id,
      name: `models/${id}`,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: cliName
    }))

    logger.info(`Returning ${formattedModels.length} models for ${cliName}`)
    return formattedModels
  }
}

export const cliService = new CliService()
