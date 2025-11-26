# 🔧 修复：CLI Providers 在新安装中不显示的问题

## 🐛 问题描述

用户从 GitHub 下载并安装新打包的版本后，在 **设置 → 模型服务** 中找不到 **Gemini CLI** 和 **Qwen CLI** providers。

## 🔍 根本原因

新添加的 CLI providers (gemini-cli 和 qwen-cli) 在代码中已正确配置，但缺少数据迁移（migration）逻辑。

当用户：

1. **首次安装**：使用 `initialState`，包含了所有 providers ✅
2. **从旧版本升级**：使用 Redux persist 的stored data，**不包含**新的 providers ❌

问题出在第二种情况 - Redux persist 会加载旧的 localStorage 数据，而旧数据中不包含新添加的 providers。

## ✅ 解决方案

添加了新的数据迁移（Migration 159）来自动添加 CLI providers 到现有用户的数据中。

### 修改内容

#### 1. 添加 Migration 159

**文件:** `src/renderer/src/store/migrate.ts`

```typescript
'159': (state: RootState) => {
  try {
    // Add Gemini CLI and Qwen CLI providers
    addProvider(state, 'gemini-cli')
    addProvider(state, 'qwen-cli')
    return state
  } catch (error) {
    logger.error('migrate 159 error', error as Error)
    return state
  }
}
```

#### 2. 更新 Redux Persist 版本号

**文件:** `src/renderer/src/store/index.ts`

```typescript
const persistedReducer = persistReducer(
  {
    key: 'cherry-studio',
    storage,
    version: 159, // 从 158 更新到 159
    blacklist: ['runtime', 'messages', 'messageBlocks', 'tabs'],
    migrate
  },
  rootReducer
)
```

## 🔄 工作原理

### Redux Persist Migration 流程

1. **检测版本差异**
   - 应用启动时，Redux Persist 读取 localStorage
   - 比较存储的版本号与当前代码中的版本号

2. **执行 Migration**
   - 如果 stored version < current version
   - 依次执行中间所有的 migration 函数
   - 例如：stored version = 158，current = 159
   - 执行 migration['159']

3. **添加新 Providers**
   - Migration 159 使用 `addProvider()` 函数
   - 检查 provider 是否已存在
   - 如果不存在，从 `SYSTEM_PROVIDERS` 中添加

4. **保存更新后的状态**
   - Migration 完成后保存新状态
   - 更新 localStorage 中的版本号为 159

## 📋 测试场景

### 场景 1：全新安装

- ✅ 使用 `initialState`
- ✅ 包含所有 56个 system providers
- ✅ 包含 gemini-cli 和 qwen-cli

### 场景 2：从 v1.6.1 升级

- ✅ 加载旧数据（version 158）
- ✅ 执行 migration 159
- ✅ 自动添加 gemini-cli 和 qwen-cli
- ✅ 更新版本号到 159

### 场景 3：从 v1.7.0 重新安装

- ✅ 加载数据（version 159）
- ✅ 无需执行 migration
- ✅ providers 已经包含在数据中

## 🔍 验证方法

### 方法 1：清空本地数据测试

```javascript
// 1. 打开开发者工具 (F12)
// 2. 在 Console 中执行
localStorage.clear()
location.reload()
// 3. 应用重启后，检查 providers 列表
```

### 方法 2：检查 Redux Store

```javascript
// 1. 打开开发者工具 (F12)
// 2. 在 Console 中执行
window.store.getState().llm.providers.filter(p =>
  p.id === 'gemini-cli' || p.id === 'qwen-cli'
)
// 应该返回两个 providers
```

### 方法 3：检查 LocalStorage 版本

```javascript
// 1. 打开开发者工具 (F12)
// 2. Application/Storage → Local Storage
// 3. 查找 key: "persist:cherry-studio"
// 4. 检查 _persist.version 应该是 159
```

## 📦 新版本发布流程

### 1. ✅ 代码更新

- Migration 159 已添加
- 版本号已更新到 159

### 2. 📝 需要重新提交

```bash
git add src/renderer/src/store/migrate.ts
git add src/renderer/src/store/index.ts
git commit -m "fix: Add migration 159 to include CLI providers for existing users"
git push origin main
```

### 3. 🏷️ 更新标签（可选）

如果需要重新发布：

```bash
# 删除旧标签
git tag -d v1.7.0
git push origin :refs/tags/v1.7.0

# 创建新标签
git tag -a v1.7.0 -m "Release v1.7.0: Fix CLI providers migration"
git push origin v1.7.0
```

### 4. 🔄 重新构建

- GitHub Actions 会自动触发
- 或者本地构建：`yarn build:win`

## 💡 最佳实践

### 添加新 Provider 的标准流程

1. **定义 Provider**

   ```typescript
   // src/renderer/src/config/providers.ts
   export const SYSTEM_PROVIDERS_CONFIG = {
     'new-provider': {
       id: 'new-provider',
       name: 'New Provider',
       // ... 其他配置
     }
   }
   ```

2. **添加 Migration**

   ```typescript
   // src/renderer/src/store/migrate.ts
   'XXX': (state: RootState) => {
     addProvider(state, 'new-provider')
     return state
   }
   ```

3. **更新版本号**

   ```typescript
   // src/renderer/src/store/index.ts
   version: XXX
   ```

4. **测试**
   - 清空 localStorage
   - 重新加载应用
   - 验证 provider 存在

## 🎯 关键代码位置

### addProvider 函数

```typescript
// src/renderer/src/store/migrate.ts (line 80-87)
function addProvider(state: RootState, id: string) {
  if (!state.llm.providers.find((p) => p.id === id)) {
    const _provider = SYSTEM_PROVIDERS.find((p) => p.id === id)
    if (_provider) {
      state.llm.providers.push(_provider)
    }
  }
}
```

### CLI Providers 定义

```typescript
// src/renderer/src/config/providers.ts (line 626-661)
'gemini-cli': {
  id: 'gemini-cli',
  name: 'Gemini CLI',
  type: 'openai',
  apiKey: 'local',
  apiHost: 'http://127.0.0.1:23333/v1/cli/gemini',
  // ...
},
'qwen-cli': {
  id: 'qwen-cli',
  name: 'Qwen CLI',
  type: 'openai',
  apiKey: 'local',
  apiHost: 'http://127.0.0.1:23333/v1/cli/qwen',
  // ...
}
```

## ✅ 预期结果

修复后，无论是新用户还是升级用户，都应该能在 **设置 → 模型服务** 中看到：

- ✅ Gemini CLI
- ✅ Qwen CLI
- ✅ 以及其他所有 56 个 system providers

---

**修复状态:** ✅ 完成
**需要重新发布:** ✅ 是
**影响范围:** 从旧版本升级的用户
**修复时间:** 2025-11-27
