import { loggerService } from '@logger'
import { TraceMethod } from '@mcp-trace/trace-core'
import { app, ipcMain } from 'electron'
import fetch from 'node-fetch'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { IpcChannel } from '@shared/IpcChannel'

const logger = loggerService.withContext('TTSService')

export interface TTSRequest {
  text: string
  speaker?: string
  emotion?: string
  url: string
}

export interface TTSResponse {
  success: boolean
  audioUrl?: string // 本地文件URL
  audioData?: Buffer // 保留兼容性
  error?: string
}

export class TTSService {
  private static tempDir: string | null = null

  // 初始化临时目录
  private static initTempDir(): string {
    if (!this.tempDir) {
      this.tempDir = path.join(app.getPath('temp'), 'cherry-studio-tts')
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true })
      }
    }
    return this.tempDir
  }

  // 生成文件名
  private static generateFileName(text: string, speaker: string, emotion: string): string {
    const hash = crypto.createHash('md5').update(`${text}|${speaker}|${emotion}`).digest('hex')
    return `tts_${hash}.wav`
  }

  @TraceMethod({ spanName: 'generateAudio', tag: 'TTSService' })
  public static async generateAudio(_: Electron.IpcMainInvokeEvent, request: TTSRequest): Promise<TTSResponse> {
    const { text, speaker = 'default', emotion = 'neutral', url } = request

    if (!text) {
      return {
        success: false,
        error: '缺少必要参数：text'
      }
    }

    if (!url) {
      return {
        success: false,
        error: '缺少必要参数：url'
      }
    }

    try {
      logger.info('Generating TTS audio', { text: text.substring(0, 50), speaker, emotion, url })

      // 初始化临时目录
      const tempDir = TTSService.initTempDir()

      // 生成文件名和路径
      const fileName = TTSService.generateFileName(text, speaker, emotion)
      const filePath = path.join(tempDir, fileName)

      // 检查文件是否已存在（缓存）
      if (fs.existsSync(filePath)) {
        logger.info('Using cached audio file', { fileName })
        return {
          success: true,
          audioUrl: `file://${filePath}`,
          audioData: fs.readFileSync(filePath) // 保留兼容性
        }
      }

      // 直接处理TTS请求，但增加超时时间
      logger.info('Processing TTS request with extended timeout', { fileName })

      // 构建TTS请求URL
      const ttsUrl = new URL(url.endsWith('/') ? url : url + '/')
      const params = new URLSearchParams({
        text: text,
        speaker: speaker
      })

      // 只有当emotion有值时才添加emo参数
      if (emotion && emotion !== 'neutral') {
        params.set('emo', emotion)
      }

      const requestUrl = `${ttsUrl.toString()}?${params.toString()}`
      logger.debug('TTS request URL', { requestUrl })

      // 发送请求到TTS服务 - 大幅增加超时时间
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'audio/wav, audio/mp3, audio/*',
          'User-Agent': 'CherryStudio/1.0'
        },
        timeout: 300000 // 5分钟超时，足够TTS生成
      })

      if (!response.ok) {
        throw new Error(`TTS服务响应错误: ${response.status} ${response.statusText}`)
      }

      // 检查响应类型
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.startsWith('audio/')) {
        logger.warn('Unexpected content type from TTS service', { contentType })
      }

      // 获取音频数据
      const audioBuffer = await response.buffer()

      if (audioBuffer.length === 0) {
        throw new Error('TTS服务返回空音频数据')
      }

      // 保存到本地文件
      fs.writeFileSync(filePath, audioBuffer)

      logger.info('TTS audio generated and saved successfully', {
        audioSize: audioBuffer.length,
        contentType,
        filePath: fileName
      })

      return {
        success: true,
        audioUrl: `file://${filePath}`,
        audioData: audioBuffer // 保留兼容性
      }
    } catch (error) {
      logger.error('Failed to generate TTS audio', error as Error)

      let errorMessage = '生成语音失败'
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'TTS服务连接失败，请检查服务是否启动'
        } else if (error.message.includes('timeout')) {
          errorMessage = 'TTS服务响应超时'
        } else {
          errorMessage = `生成语音失败: ${error.message}`
        }
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 注册IPC处理器
   */
  public static registerIpcHandlers(): void {
    ipcMain.handle(IpcChannel.TTS_GenerateAudio, this.generateAudio)
    logger.info('TTS IPC handlers registered')
  }
}

// 导出单例实例
export const ttsService = new TTSService()
