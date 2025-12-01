import { Request, Response } from 'express'

import { loggerService } from '../../services/LoggerService'
import mcpService from '../../services/MCPService'
import { reduxService } from '../../services/ReduxService'

const logger = loggerService.withContext('MCPApiService')

interface MCPServerInfo {
  id: string
  name: string
  description?: string
  status: 'connected' | 'disconnected' | 'error'
  capabilities?: {
    tools?: boolean
    prompts?: boolean
    resources?: boolean
  }
  version?: string
  lastConnected?: string
}

class MCPApiService {
  /**
   * Get all configured MCP servers
   */
  async getAllServers(_req: Request): Promise<MCPServerInfo[]> {
    try {
      logger.info('Fetching all MCP servers')

      // Get MCP servers from Redux store
      const state = await reduxService.select('state')
      const mcpServers = state?.mcpServers || []

      logger.debug('Retrieved MCP servers from Redux:', {
        serverCount: mcpServers.length
      })

      const serverInfos: MCPServerInfo[] = []

      for (const server of mcpServers) {
        try {
          // Check server status and capabilities
          const isConnected = await this.checkServerConnection(server)

          const serverInfo: MCPServerInfo = {
            id: server.id,
            name: server.name,
            description: server.description,
            status: isConnected ? 'connected' : 'disconnected',
            capabilities: {
              tools: true, // Assume all servers support tools
              prompts: true, // Assume all servers support prompts
              resources: true // Assume all servers support resources
            },
            version: server.version,
            lastConnected: server.lastConnected
          }

          serverInfos.push(serverInfo)
        } catch (error: any) {
          logger.warn(`Error checking server ${server.name}:`, error)

          serverInfos.push({
            id: server.id,
            name: server.name,
            description: server.description,
            status: 'error',
            capabilities: {},
            version: server.version
          })
        }
      }

      logger.info(`Returning ${serverInfos.length} MCP servers`)
      return serverInfos
    } catch (error: any) {
      logger.error('Error fetching MCP servers:', error)
      throw new Error(`Failed to fetch MCP servers: ${error.message}`)
    }
  }

  /**
   * Get specific MCP server information
   */
  async getServerInfo(serverId: string): Promise<MCPServerInfo | null> {
    try {
      logger.info('Fetching MCP server info:', { serverId })

      const state = await reduxService.select('state')
      const mcpServers = state?.mcpServers || []

      const server = mcpServers.find((s: any) => s.id === serverId)
      if (!server) {
        logger.warn('MCP server not found:', { serverId })
        return null
      }

      const isConnected = await this.checkServerConnection(server)

      return {
        id: server.id,
        name: server.name,
        description: server.description,
        status: isConnected ? 'connected' : 'disconnected',
        capabilities: {
          tools: true,
          prompts: true,
          resources: true
        },
        version: server.version,
        lastConnected: server.lastConnected
      }
    } catch (error: any) {
      logger.error('Error fetching MCP server info:', error)
      throw new Error(`Failed to fetch MCP server info: ${error.message}`)
    }
  }

  /**
   * Get MCP server by ID
   */
  async getServerById(serverId: string): Promise<any | null> {
    try {
      const state = await reduxService.select('state')
      const mcpServers = state?.mcpServers || []

      return mcpServers.find((s: any) => s.id === serverId) || null
    } catch (error: any) {
      logger.error('Error getting MCP server by ID:', error)
      return null
    }
  }

  /**
   * Handle MCP request forwarding
   */
  async handleRequest(req: Request, res: Response, server: any): Promise<void> {
    try {
      logger.info('Handling MCP request:', {
        serverId: server.id,
        method: req.method,
        path: req.path
      })

      // This is a simplified implementation
      // In a real implementation, you would forward the request to the actual MCP server
      // For now, we'll return a basic response

      res.json({
        success: true,
        message: 'MCP request forwarding not yet implemented',
        server: {
          id: server.id,
          name: server.name
        }
      })
    } catch (error: any) {
      logger.error('Error handling MCP request:', error)
      res.status(500).json({
        success: false,
        error: {
          message: `Failed to handle MCP request: ${error.message}`,
          type: 'server_error',
          code: 'mcp_request_failed'
        }
      })
    }
  }

  /**
   * Check if MCP server is connected
   */
  private async checkServerConnection(server: any): Promise<boolean> {
    try {
      // Use the existing MCP service to check connectivity
      const result = await mcpService.checkMcpConnectivity(null as any, server)
      return result || false
    } catch (error: any) {
      logger.debug('Server connection check failed:', { serverId: server.id, error: error.message })
      return false
    }
  }
}

// Export singleton instance
export const mcpApiService = new MCPApiService()
