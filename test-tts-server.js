#!/usr/bin/env node

/**
 * 简单的TTS测试服务器
 * 用于测试Cherry Studio的音频播放功能
 *
 * 使用方法：
 * 1. 安装依赖：npm install express
 * 2. 运行服务器：node test-tts-server.js
 * 3. 服务器将在 http://localhost:9880 启动
 */

const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = 9880

// 生成简单的WAV文件头（静音音频）
function generateSilentWav(durationMs = 1000, sampleRate = 22050) {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000)
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numSamples * blockAlign
  const fileSize = 36 + dataSize

  const buffer = Buffer.alloc(44 + dataSize)
  let offset = 0

  // WAV文件头
  buffer.write('RIFF', offset)
  offset += 4
  buffer.writeUInt32LE(fileSize, offset)
  offset += 4
  buffer.write('WAVE', offset)
  offset += 4
  buffer.write('fmt ', offset)
  offset += 4
  buffer.writeUInt32LE(16, offset)
  offset += 4 // fmt chunk size
  buffer.writeUInt16LE(1, offset)
  offset += 2 // audio format (PCM)
  buffer.writeUInt16LE(numChannels, offset)
  offset += 2
  buffer.writeUInt32LE(sampleRate, offset)
  offset += 4
  buffer.writeUInt32LE(byteRate, offset)
  offset += 4
  buffer.writeUInt16LE(blockAlign, offset)
  offset += 2
  buffer.writeUInt16LE(bitsPerSample, offset)
  offset += 2
  buffer.write('data', offset)
  offset += 4
  buffer.writeUInt32LE(dataSize, offset)
  offset += 4

  // 静音数据（全部为0）
  buffer.fill(0, offset)

  return buffer
}

// 生成带有简单音调的WAV文件
function generateToneWav(frequency = 440, durationMs = 1000, sampleRate = 22050) {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000)
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numSamples * blockAlign
  const fileSize = 36 + dataSize

  const buffer = Buffer.alloc(44 + dataSize)
  let offset = 0

  // WAV文件头
  buffer.write('RIFF', offset)
  offset += 4
  buffer.writeUInt32LE(fileSize, offset)
  offset += 4
  buffer.write('WAVE', offset)
  offset += 4
  buffer.write('fmt ', offset)
  offset += 4
  buffer.writeUInt32LE(16, offset)
  offset += 4
  buffer.writeUInt16LE(1, offset)
  offset += 2
  buffer.writeUInt16LE(numChannels, offset)
  offset += 2
  buffer.writeUInt32LE(sampleRate, offset)
  offset += 4
  buffer.writeUInt32LE(byteRate, offset)
  offset += 4
  buffer.writeUInt16LE(blockAlign, offset)
  offset += 2
  buffer.writeUInt16LE(bitsPerSample, offset)
  offset += 2
  buffer.write('data', offset)
  offset += 4
  buffer.writeUInt32LE(dataSize, offset)
  offset += 4

  // 生成音调数据
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3 * 32767
    buffer.writeInt16LE(Math.round(sample), offset)
    offset += 2
  }

  return buffer
}

// 根据说话者和情感选择不同的音调
function getFrequencyForSpeaker(speaker, emotion) {
  const frequencies = {
    苏瑶: { base: 350, flirty: 380, playful: 400, sweet: 320, happy: 420 },
    旁白: { base: 250, seductive: 280, mischievous: 300, neutral: 250 },
    default: { base: 300, neutral: 300 }
  }

  const speakerFreqs = frequencies[speaker] || frequencies['default']
  return speakerFreqs[emotion] || speakerFreqs.base || 300
}

// CORS中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// TTS端点 - 优化版本，快速响应
app.get('/', (req, res) => {
  const startTime = Date.now()
  const { text, speaker = 'default', emotion = 'neutral' } = req.query

  console.log(`[${new Date().toISOString()}] TTS Request:`, {
    text: text ? text.substring(0, 50) + (text.length > 50 ? '...' : '') : 'undefined',
    speaker,
    emotion,
    textLength: text ? text.length : 0
  })

  if (!text) {
    return res.status(400).json({ error: 'Missing text parameter' })
  }

  try {
    // 优化：限制最大音频长度，避免生成时间过长
    const duration = Math.max(500, Math.min(3000, text.length * 30)) // 减少每字符时间

    // 根据说话者和情感选择音调
    const frequency = getFrequencyForSpeaker(speaker, emotion)

    // 生成WAV音频 - 使用更快的生成方法
    const audioBuffer = generateToneWav(frequency, duration)

    const processingTime = Date.now() - startTime

    console.log(`[${new Date().toISOString()}] Generated audio:`, {
      duration: `${duration}ms`,
      frequency: `${frequency}Hz`,
      size: `${audioBuffer.length} bytes`,
      processingTime: `${processingTime}ms`
    })

    // 设置响应头
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=3600', // 缓存1小时
      'X-Processing-Time': processingTime.toString()
    })

    res.send(audioBuffer)
  } catch (error) {
    console.error('Error generating audio:', error)
    res.status(500).json({ error: 'Failed to generate audio' })
  }
})

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Test TTS Server'
  })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`🎵 Test TTS Server started on http://localhost:${PORT}`)
  console.log(`📝 Health check: http://localhost:${PORT}/health`)
  console.log(`🎤 TTS endpoint: http://localhost:${PORT}/?text=你好&speaker=苏瑶&emotion=happy`)
  console.log(`⏹️  Press Ctrl+C to stop`)
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Test TTS Server...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Test TTS Server...')
  process.exit(0)
})
