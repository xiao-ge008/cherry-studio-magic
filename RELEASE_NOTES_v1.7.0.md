# Cherry Studio Magic v1.7.0 Release Notes

## 🎉 版本说明

**Release Date:** 2025-11-27
**Version:** 1.7.0-magic

---

## ✨ 新功能 (New Features)

### 🤖 CLI 本地转 OpenAI API 支持

本版本新增了对 **Gemini CLI** 和 **Qwen CLI** 的本地转 OpenAI API 支持，无需 API Key 即可直接使用本地 CLI 工具调用 AI 模型！

#### 支持的 CLI 工具

1. **Gemini CLI** - Google Gemini 命令行工具
   - 本地无密钥调用 Gemini 模型
   - 默认 API 地址：`http://127.0.0.1:23333/v1/cli/gemini`
   - 支持流式响应

2. **Qwen CLI** - 通义千问命令行工具
   - 本地无密钥调用 Qwen 模型
   - 默认 API 地址：`http://127.0.0.1:23333/v1/cli/qwen`
   - 支持流式响应

#### 技术实现

- ✅ 内置 Express API 服务器（端口 23333）
- ✅ OpenAI 兼容的 API 接口
- ✅ 自动启动和管理 CLI 进程
- ✅ 流式响应支持
- ✅ 错误处理和日志记录
- ✅ 系统提示词全局配置

---

## 🎨 UI/UX 优化

### CLI 设置页面优化

#### 1. API 服务器地址配置

- 📍 清晰的标题显示："API 服务器地址"
- 💡 默认地址提示和说明
- 🔄 一键重置按钮
- ✨ Placeholder 优化

#### 2. 全局系统提示词编辑器

- ✏️ 内联编辑：4-8 行快速编辑
- 🖼️ 全局编辑器：点击设置图标打开大窗口
- 📏 全屏模式：提供最大编辑空间
- 🔤 等宽字体：Consolas/Monaco，适合编写代码
- 🌐 多语言支持：中英文界面
- 💡 使用提示和示例

#### 3. 全屏编辑功能

- ⛶ 全屏切换按钮（右上角）
- 📐 响应式布局
- 💾 状态保持（切换不丢失内容）
- 🎯 专注模式（隐藏非必要信息）

---

## 📋 详细变更

### 新增文件

**API Server 路由：**

- `src/main/apiServer/routes/cli.ts` - CLI 路由处理
- `src/main/apiServer/routes/index.ts` - 路由统一导出

**CLI Provider 配置：**

- `src/renderer/src/pages/settings/ProviderSettings/CliSystemPromptPopup.tsx` - 系统提示词编辑器

**文档：**

- `.agent/CLI_Settings_Optimization_Summary.md` - 设置优化总结
- `.agent/CLI_Fullscreen_Feature.md` - 全屏功能文档
- `RELEASE_NOTES_v1.7.0.md` - 版本发布说明

### 修改文件

**配置文件：**

- `package.json` - 版本号更新到 1.7.0-magic
- `src/renderer/src/config/providers.ts` - 添加 gemini-cli 和 qwen-cli provider

**UI 组件：**

- `src/renderer/src/pages/settings/ProviderSettings/ProviderSetting.tsx` - CLI 设置 UI 优化

**API Server：**

- `src/main/apiServer/index.ts` - 添加 CLI 路由支持
- `src/main/index.ts` - API Server 集成

---

## 🚀 使用方法

### 1. 启动 Cherry Studio

```bash
yarn dev
```

### 2. 配置 CLI Provider

#### 方式一：使用界面

1. 打开 **设置 → 模型服务**
2. 找到 **"Gemini CLI"** 或 **"Qwen CLI"**
3. 启用 provider
4. 查看默认 API 地址：`http://127.0.0.1:23333/v1/cli/gemini` 或 `/qwen`
5. （可选）设置全局系统提示词

#### 方式二：直接启用

- CLI providers 会自动使用本地 API 服务器
- 无需配置 API Key
- API 地址已预设，开启即用

### 3. 配置系统提示词（可选）

#### 内联编辑

直接在设置页面的文本框中输入（4-8 行）

#### 全局编辑器

1. 点击 "CLI 全局系统提示词" 右侧的设置图标 ⚙️
2. 在弹窗中编辑（12-20 行）
3. 点击右上角 ⛶ 进入全屏模式（最大化编辑空间）
4. 编辑完成后点击 "保存"

#### 示例系统提示词

```
你是一个专业的编程助手。
- 请始终用中文回答
- 代码注释请使用中文
- 回答要简洁明了，重点突出
- 提供可运行的代码示例
```

### 4. 开始对话

- 创建新对话
- 选择 "Gemini CLI" 或 "Qwen CLI" 模型
- 开始聊天！

---

## 🔧 技术细节

### API Server

- **框架:** Express.js
- **端口:** 23333
- **路由:** `/v1/cli/gemini/*` 和 `/v1/cli/qwen/*`
- **兼容:** OpenAI API 格式

### 接口规范

#### Chat Completions

```
POST http://127.0.0.1:23333/v1/cli/gemini/chat/completions
POST http://127.0.0.1:23333/v1/cli/qwen/chat/completions
```

**请求体：**

```json
{
  "model": "gemini-cli",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": true
}
```

**响应：**

- 支持流式响应（SSE）
- OpenAI 兼容格式

#### Models List

```
GET http://127.0.0.1:23333/v1/cli/gemini/models
GET http://127.0.0.1:23333/v1/cli/qwen/models
```

---

## 📊 性能优化

- ✅ 流式响应减少首字延迟
- ✅ 自动错误重试机制
- ✅ 日志记录便于调试
- ✅ 进程管理确保稳定性

---

## 🐛 已知问题

无重大已知问题。

---

## 📦 构建说明

### Windows 构建

```bash
yarn build:win
```

生成：

- `CherryStudio-Setup-1.7.0-magic.exe` (安装程序)
- `CherryStudio-1.7.0-magic-win.zip` (便携版)

### macOS 构建

```bash
yarn build:mac
```

生成：

- `CherryStudio-1.7.0-magic.dmg` (Intel + Apple Silicon)
- `CherryStudio-1.7.0-magic-arm64.dmg` (Apple Silicon)
- `CherryStudio-1.7.0-magic-x64.dmg` (Intel)

---

## 🙏 致谢

感谢所有贡献者和用户的支持！

---

## 📝 升级说明

### 从 v1.6.x 升级

1. **自动更新：** 应用内会自动提示更新
2. **手动安装：** 下载最新安装包直接安装
3. **配置迁移：** 所有设置自动保留

### 新用户

直接下载并安装最新版本即可。

---

## 📄 许可证

与主项目保持一致

---

## 🔗 相关链接

- **项目主页：** <https://github.com/CherryHQ/cherry-studio>
- **问题反馈：** <https://github.com/CherryHQ/cherry-studio/issues>
- **文档：** <https://docs.cherry-ai.com>

---

**祝使用愉快！** 🎉
