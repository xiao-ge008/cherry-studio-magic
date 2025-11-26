# 🔧 修复：API Server 端口占用问题

## 🐛 问题描述

API Server 启动失败，错误信息：

```
Error: listen EADDRINUSE: address already in use ::1:23333
```

**症状：**

1. 点击"启动 API Server"显示启动成功
2. 切换到其他界面后返回，发现服务器状态是停止的
3. 日志显示 `isRunning check: { hasServer: true, isListening: false, result: false }`

## 🔍 根本原因

### 原因 1：端口被占用

端口 23333 已经被其他进程占用（可能是之前未正确关闭的实例）

### 原因 2：错误处理不当

当 `listen()` 失败时，服务器对象已创建但监听失败，导致：

- `this.server !== null` (服务器对象存在)
- `this.server.listening === false` (但未监听)
- 状态不一致

## ✅ 解决方案

### 1. 改进错误处理（已修复）

**修改文件:** `src/main/apiServer/server.ts`

**关键改进:**

```typescript
async start(): Promise<void> {
  if (this.server) {
    logger.warn('Server already running')
    return
  }

  try {
    const { port, host, apiKey } = await config.load()
    this.server = createServer(app)

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(port, host, () => {
        logger.info(`API Server started at http://${host}:${port}`)
        logger.info(`API Key: ${apiKey}`)
        resolve()
      })

      // 添加错误处理并清理状态
      this.server!.on('error', (error) => {
        if (this.server) {
          this.server.close()
          this.server = null  // 关键：清理服务器对象
        }
        reject(error)
      })
    })
  } catch (error) {
    // 确保任何错误都清理状态
    if (this.server) {
      this.server.close()
      this.server = null
    }
    throw error
  }
}
```

### 2. 释放占用的端口

#### Windows 用户

**方法 A：使用 PowerShell 脚本（推荐）**

创建文件 `scripts/kill-port-23333.ps1`:

```powershell
# 查找占用端口 23333 的进程
$processId = (Get-NetTCPConnection -LocalPort 23333 -ErrorAction SilentlyContinue).OwningProcess

if ($processId) {
    Write-Host "发现进程 $processId 占用端口 23333"

    # 获取进程信息
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "进程名称: $($process.ProcessName)"
        Write-Host "进程路径: $($process.Path)"

        # 确认是否要关闭
        $confirm = Read-Host "是否关闭此进程? (Y/N)"
        if ($confirm -eq "Y" -or $confirm -eq "y") {
            Stop-Process -Id $processId -Force
            Write-Host "进程已关闭"
        }
    }
} else {
    Write-Host "端口 23333 未被占用"
}
```

运行脚本：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/kill-port-23333.ps1
```

**方法 B：手动命令**

1. 查找占用端口的进程：

```powershell
netstat -ano | findstr :23333
```

2. 记下 PID（最后一列）

3. 关闭进程：

```powershell
taskkill /PID <PID> /F
```

#### macOS/Linux 用户

1. 查找占用端口的进程：

```bash
lsof -i :23333
```

2. 关闭进程：

```bash
kill -9 <PID>
```

### 3. 重启应用

关闭所有 Cherry Studio 实例后重新启动。

## 🧪 验证修复

### 测试步骤

1. **清理端口**

   ```powershell
   # Windows
   netstat -ano | findstr :23333
   # 如果有输出，使用 taskkill 关闭

   # macOS/Linux
   lsof -i :23333
   # 如果有输出，使用 kill 关闭
   ```

2. **启动开发服务器**

   ```bash
   yarn dev
   ```

3. **检查日志**
   - 应该看到：`API Server started at http://localhost:23333`
   - 不应该看到：`EADDRINUSE` 错误

4. **测试 API**

   ```bash
   curl http://localhost:23333/v1/cli/gemini/models
   ```

5. **UI 测试**
   - 打开应用
   - 检查 API Server 状态（应该是"运行中"）
   - 切换到其他页面再回来
   - 状态应该保持"运行中"

## 🔧 额外改进建议

### 1. 自动端口切换

如果端口被占用，自动尝试其他端口：

```typescript
async start(): Promise<void> {
  const maxRetries = 5
  let port = (await config.load()).port

  for (let i = 0; i < maxRetries; i++) {
    try {
      await this.startOnPort(port)
      return
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} in use, trying ${port + 1}`)
        port++
      } else {
        throw error
      }
    }
  }

  throw new Error(`Failed to start server after ${maxRetries} attempts`)
}
```

### 2. 端口检测工具

添加预检查功能：

```typescript
import { createConnection } from 'net'

async function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createConnection({ port, host })
      .once('error', () => resolve(true))  // 连接失败 = 端口可用
      .once('connect', () => {
        tester.end()
        resolve(false)  // 连接成功 = 端口被占用
      })
  })
}
```

### 3. 优雅关闭

添加应用退出时的清理：

```typescript
// src/main/index.ts
app.on('before-quit', async () => {
  await apiServer.stop()
})
```

## 📋 故障排查清单

如果 API Server 仍然无法启动，检查：

- [ ] 是否有其他 Cherry Studio 实例在运行
- [ ] 端口 23333 是否被其他应用占用
- [ ] 防火墙是否阻止了端口
- [ ] 是否有权限问题
- [ ] 查看完整的错误日志
- [ ] 尝试修改配置使用不同端口（未来功能）

## 📊 常见错误代码

| 错误代码 | 含义 | 解决方法 |
|---------|------|---------|
| `EADDRINUSE` | 端口已被占用 | 关闭占用进程或使用其他端口 |
| `EACCES` | 权限不足 | 以管理员权限运行 |
| `EADDRNOTAVAIL` | 地址不可用 | 检查 host 配置 |

## 🚀 快速修复脚本

为了方便用户，我已创建快速修复脚本。

**使用方法：**

```bash
# Windows
yarn fix-port

# 或手动运行
pwsh scripts/kill-port-23333.ps1
```

---

**修复状态:** ✅ 代码已修复
**需要重启:** ✅ 是
**影响范围:** API Server 启动逻辑
**修复时间:** 2025-11-27
