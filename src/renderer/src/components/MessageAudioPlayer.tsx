import React from 'react'
import type { Message } from '@renderer/types/newMessage'

type Props = {
  message: Message
}

// Minimal stub to unblock runtime. Can be enhanced to actually play audio.
const MessageAudioPlayer: React.FC<Props> = () => {
  return null
}

export default MessageAudioPlayer

