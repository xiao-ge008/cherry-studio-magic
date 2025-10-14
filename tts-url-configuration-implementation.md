# 🎵 TTS URL配置功能实现完成

## 🎯 实现目标

将TTS服务的URL从组件参数改为后端的固定配置，用户只需在设置中配置一次TTS服务地址，所有`<audio-message>`组件都会使用这个固定的URL。

## ✅ 已完成的修改

### 1. 后端配置系统

#### ConfigManager (`src/main/services/ConfigManager.ts`)
- ✅ 添加 `TTSServiceUrl = 'ttsServiceUrl'` 配置键
- ✅ 添加 `getTTSServiceUrl()` 方法，默认值为 `'http://localhost:9880/'`
- ✅ 添加 `setTTSServiceUrl(url: string)` 方法

#### TTSService (`src/main/services/TTSService.ts`)
- ✅ 导入 `configManager`
- ✅ 修改 `TTSRequest` 接口，移除 `url` 参数
- ✅ 修改 `generateAudio` 方法：
  - 从配置中获取URL：`const url = configManager.getTTSServiceUrl()`
  - 添加URL未配置的错误处理
  - 移除对请求参数中url的依赖

### 2. 前端API接口

#### Preload (`src/preload/index.ts`)
- ✅ 修改 `tts.generateAudio` 接口，移除 `url` 参数
- ✅ 保持返回值接口不变

### 3. Redux状态管理

#### Settings Store (`src/renderer/src/store/settings.ts`)
- ✅ 添加 `ttsServiceUrl: string` 状态字段
- ✅ 设置默认值为 `'http://localhost:9880/'`
- ✅ 添加 `setTTSServiceUrl` action
- ✅ 导出action到公共接口

### 4. 组件配置更新

#### Component Types (`src/renderer/src/types/component.ts`)
- ✅ 从 `audio-message` 组件配置中移除 `url` 参数
- ✅ 保留其他参数：`text`, `speaker`, `role`, `emo`, `autoplay`

### 5. 前端组件修改

#### MarkdownAudioMessage (`src/renderer/src/pages/home/Markdown/MarkdownAudioMessage.tsx`)
- ✅ 修改 `MarkdownAudioMessageProps` 接口，移除 `url` 参数
- ✅ 修改 `generateCacheKey` 函数，移除URL参数
- ✅ 修改组件props解构，移除 `url = ''`
- ✅ 更新所有使用url的地方：
  - 缓存键生成
  - 参数变化检测
  - TTS API调用
  - 日志记录

### 6. 设置界面

#### TTS设置页面 (`src/renderer/src/pages/settings/ToolSettings/TTSSettings/`)
- ✅ 创建 `TTSSettings.tsx` 组件
- ✅ 提供TTS服务URL配置界面
- ✅ 添加测试连接功能
- ✅ 提供使用说明和API规范说明

#### 设置页面路由 (`src/renderer/src/pages/settings/SettingsPage.tsx`)
- ✅ 添加TTS设置路由：`<Route path="tts" element={<TTSSettings />} />`
- ✅ 添加菜单项：TTS语音服务
- ✅ 导入必要的组件和图标

## 🎨 新的使用方式

### 用户配置流程
1. 打开设置页面
2. 点击"TTS语音服务"菜单
3. 配置TTS服务地址（如：`http://localhost:9880/`）
4. 点击"测试连接"验证服务可用性
5. 保存配置

### 组件使用方式

#### ✅ 新的语法（无需URL参数）
```markdown
<audio-message
  role="speech"
  text="你好，我是AI助手！"
  speaker="小雅"
  emo="friendly"
/>

<audio-message
  role="action"
  text="苏瑶转过身去，故意撅起小嘴"
  speaker="旁白"
  emo="flirty"
/>
```

#### ❌ 旧的语法（不再需要）
```markdown
<audio-message
  role="speech"
  text="你好，我是AI助手！"
  speaker="小雅"
  emo="friendly"
  url="http://localhost:9880/"  <!-- 不再需要这个参数 -->
/>
```

## 🔧 技术架构

### 数据流
```
用户设置 → Redux Store → ConfigManager → TTSService → TTS服务器
                ↓
         前端组件 → window.api.tts.generateAudio() → 后端使用配置的URL
```

### 配置同步
- 前端设置界面修改URL → Redux Store
- 后端服务读取URL → ConfigManager (electron-store)
- 配置持久化存储在用户数据目录

## ✅ 最终修复

### 9. 组件编辑页面优化

#### 移除URL字段显示 (`src/renderer/src/pages/settings/ComponentSettings/ComponentEditPage.tsx`)
- ✅ 移除了 `editingComponent.url` 的条件显示
- ✅ 添加了audio-message组件的特殊提示信息
- ✅ 提示用户TTS服务URL现在在设置中统一配置

#### 更新示例代码 (`src/renderer/src/types/component.ts`)
- ✅ 移除示例代码中的URL参数
- ✅ 更新为新的简洁语法

## 🧪 测试验证

### 1. 配置测试
- [x] 打开设置页面，找到"TTS语音服务"菜单
- [x] 配置TTS服务URL
- [x] 点击"测试连接"，验证连接成功

### 2. 组件编辑测试
- [x] 打开audio-message组件编辑页面
- [x] 确认URL字段不再显示在基本信息或参数配置中
- [x] 确认显示TTS服务配置提示信息

### 3. 组件使用测试
- [x] 在Markdown中使用新语法（无url参数）
- [x] 验证音频正常生成和播放
- [x] 测试不同的speaker和emo参数

### 4. 错误处理测试
- [ ] 配置错误的URL，验证错误提示
- [ ] 清空URL配置，验证错误处理
- [ ] TTS服务不可用时的错误提示

## 🎯 优势

1. **简化使用**：用户不需要在每个组件中重复配置URL
2. **集中管理**：TTS服务地址统一配置，便于维护
3. **更好的用户体验**：设置一次，全局生效
4. **向后兼容**：保持其他参数不变，只移除URL参数
5. **错误处理**：提供清晰的配置和连接错误提示

## 📝 文档更新

需要更新以下文档：
- [ ] `docs/plugins-usage-guide.md` - 更新audio-message使用说明
- [ ] `docs/plugins-quick-start.md` - 更新快速入门指南
- [ ] `AUDIO_COMPONENTS_README.md` - 更新组件说明

## 🚀 部署说明

1. **现有用户**：首次启动时会使用默认URL `http://localhost:9880/`
2. **新用户**：需要在设置中配置TTS服务地址
3. **迁移**：旧的带url参数的组件仍然可以工作（向后兼容）

现在TTS服务URL已经成功配置化，用户可以在设置中统一管理TTS服务地址了！🎉
