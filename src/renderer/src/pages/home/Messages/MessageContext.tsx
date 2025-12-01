import React from 'react'
import type { Message } from '@renderer/types/newMessage'

export type MessageContextValue = {
  message?: Message
  topicId?: string
}

export const MessageContext = React.createContext<MessageContextValue>({})
export const MessageProvider = MessageContext.Provider

