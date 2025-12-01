# 🚀 GitHub Release 发布指南 - v1.7.0

## ✅ 已完成步骤

### 1. 代码推送

- ✅ 代码已推送到 `main` 分支
- ✅ 标签 `v1.7.0` 已创建并推送
- ✅ Commit: `4514811`

### 2. GitHub Actions 自动触发

由于我们推送了 `v1.7.0` 标签，GitHub Actions 会自动触发 Release 工作流！

---

## 📋 GitHub Actions 工作流程

### 触发条件

Release 工作流会在以下情况触发：

1. **推送 tag**: `v*.*.*` 格式（已触发 ✅）
2. **手动触发**: 通过 GitHub Actions 界面

### 构建矩阵

工作流会并行构建三个平台：

- 🪟 **Windows** (windows-latest)
- 🍎 **macOS** (macos-latest)
- 🐧 **Linux** (ubuntu-latest)

### 构建产物

每个平台会生成：

**Windows:**

- `Cherry-Studio-Setup-1.7.0-magic.exe` (x64 安装程序)
- `Cherry-Studio-1.7.0-magic-arm64-setup.exe` (ARM64 安装程序)
- `Cherry-Studio-1.7.0-magic-win.zip` (便携版)
- `latest.yml` (更新元数据)

**macOS:**

- `Cherry-Studio-1.7.0-magic.dmg` (通用版, Intel + Apple Silicon)
- `Cherry-Studio-1.7.0-magic-arm64.dmg` (Apple Silicon)
- `Cherry-Studio-1.7.0-magic-x64.dmg` (Intel)
- `latest-mac.yml` (更新元数据)

**Linux:**

- `Cherry-Studio-1.7.0-magic.AppImage` (AppImage)
- `Cherry-Studio-1.7.0-magic.snap` (Snap)
- `Cherry-Studio-1.7.0-magic.deb` (Debian/Ubuntu)
- `Cherry-Studio-1.7.0-magic.rpm` (Red Hat/Fedora)
- `Cherry-Studio-1.7.0-magic.tar.gz` (通用)

---

## 🔍 查看构建状态

### 方式一：GitHub Actions 页面

1. 打开仓库：<https://github.com/xiao-ge008/cherry-studio-magic>
2. 点击 **Actions** 标签
3. 找到 **Release** 工作流
4. 查看最新的运行记录（tag: v1.7.0）

### 方式二：直接链接

```
https://github.com/xiao-ge008/cherry-studio-magic/actions/workflows/release.yml
```

### 构建状态指示

- 🟡 **黄色（进行中）**: 构建正在运行
- ✅ **绿色（成功）**: 构建成功完成
- ❌ **红色（失败）**: 构建失败，需要检查日志

---

## 📦 发布 Release

### 自动创建草稿

工作流配置了 `draft: true`，所以构建完成后会：

1. 自动创建一个 **草稿 Release**
2. 上传所有构建产物
3. 使用 tag `v1.7.0`

### 手动发布步骤

#### 1. 等待构建完成

- 所有三个平台都构建成功（约 15-30 分钟）
- 检查每个平台的构建日志

#### 2. 访问 Releases 页面

```
https://github.com/xiao-ge008/cherry-studio-magic/releases
```

#### 3. 编辑草稿 Release

点击草稿 Release 的 **Edit** 按钮

#### 4. 完善 Release 信息

**Release Title:**

```
Cherry Studio Magic v1.7.0 - CLI Support 🤖
```

**Release Notes:**
粘贴 `RELEASE_NOTES_v1.7.0.md` 的内容，或者使用以下简化版本：

```markdown
## 🎉 Cherry Studio Magic v1.7.0

### ✨ 新功能

#### CLI 本地转 OpenAI API 支持
- 🤖 **Gemini CLI** - 本地调用 Google Gemini 模型
- 🤖 **Qwen CLI** - 本地调用通义千问模型
- 🌐 内置 API 服务器（端口 23333）
- ⚡ OpenAI 兼容接口
- 📝 流式响应支持
- 🎨 全局系统提示词配置

### 🎨 UI/UX 优化
- ✨ CLI 设置页面全新优化
- 📝 全局系统提示词编辑器
- 🖥️ 全屏编辑模式
- 🌐 多语言支持（中英文）

### 📥 下载

**Windows:**
- 安装版（推荐）: `Cherry-Studio-Setup-1.7.0-magic.exe`
- ARM64 版本: `Cherry-Studio-1.7.0-magic-arm64-setup.exe`
- 便携版: `Cherry-Studio-1.7.0-magic-win.zip`

**macOS:**
- 通用版（推荐）: `Cherry-Studio-1.7.0-magic.dmg`
- Apple Silicon: `Cherry-Studio-1.7.0-magic-arm64.dmg`
- Intel: `Cherry-Studio-1.7.0-magic-x64.dmg`

**Linux:**
- AppImage: `Cherry-Studio-1.7.0-magic.AppImage`
- Debian/Ubuntu: `Cherry-Studio-1.7.0-magic.deb`
- Red Hat/Fedora: `Cherry-Studio-1.7.0-magic.rpm`

### 📖 使用方法

1. 下载并安装对应平台的安装包
2. 打开 **设置 → 模型服务**
3. 启用 **Gemini CLI** 或 **Qwen CLI**
4. （可选）配置全局系统提示词
5. 开始使用！

### 🔗 相关链接
- 📖 [完整发布说明](RELEASE_NOTES_v1.7.0.md)
- 🐛 [问题反馈](https://github.com/xiao-ge008/cherry-studio-magic/issues)
- 📚 [使用文档](.agent/CLI_Settings_Optimization_Summary.md)

---

**祝使用愉快！** 🎉
```

#### 5. 设置 Release 选项

- ✅ **Set as the latest release**: 勾选（如果这是最新稳定版）
- ⚠️ **Set as a pre-release**: 取消勾选（除非是测试版）
- 📝 **Create a discussion**: 可选

#### 6. 发布

点击 **Publish release** 按钮

---

## 🔧 故障排除

### 构建失败

如果构建失败，检查：

1. **环境变量**: 确保所有必需的 secrets 和 variables 已配置
2. **依赖问题**: 查看构建日志中的错误信息
3. **磁盘空间**: GitHub Actions runner 可能空间不足

### 重新触发构建

#### 方式一：删除标签并重新推送

```bash
# 删除本地标签
git tag -d v1.7.0

# 删除远程标签
git push origin :refs/tags/v1.7.0

# 重新创建并推送
git tag -a v1.7.0 -m "Release v1.7.0"
git push origin v1.7.0
```

#### 方式二：手动触发工作流

1. 访问 Actions 页面
2. 选择 **Release** 工作流
3. 点击 **Run workflow**
4. 输入标签名 `v1.7.0`
5. 点击 **Run workflow**

---

## 📊 预期时间线

| 阶段 | 预计时间 |
|------|---------|
| ✅ 推送代码和标签 | 已完成 |
| 🔄 触发 GitHub Actions | 1-2 分钟 |
| 🔄 下载依赖 | 3-5 分钟 |
| 🔄 Windows 构建 | 10-15 分钟 |
| 🔄 macOS 构建 | 15-20 分钟 |
| 🔄 Linux 构建 | 10-15 分钟 |
| 🔄 上传产物 | 2-5 分钟 |
| 📝 编辑 Release | 5-10 分钟 |
| **总计** | **约 30-50 分钟** |

---

## ✅ 检查清单

### 自动化步骤（GitHub Actions）

- [ ] Windows 构建完成
- [ ] macOS 构建完成
- [ ] Linux 构建完成
- [ ] 创建草稿 Release
- [ ] 上传所有产物

### 手动步骤

- [ ] 访问 Releases 页面
- [ ] 检查所有产物已上传
- [ ] 编辑 Release 信息
- [ ] 添加 Release Notes
- [ ] 设置为最新版本
- [ ] 发布 Release

### 发布后

- [ ] 验证下载链接
- [ ] 测试自动更新功能
- [ ] 更新项目文档
- [ ] 发布更新公告

---

## 🎯 当前状态

### Git 仓库

- ✅ Commit: `4514811`
- ✅ Tag: `v1.7.0`
- ✅ 已推送到远程

### GitHub Actions

- 🔄 状态: 应该已自动触发
- 📍 查看: <https://github.com/xiao-ge008/cherry-studio-magic/actions>

### 下一步

1. 访问 GitHub Actions 页面查看构建状态
2. 等待所有平台构建完成
3. 编辑并发布草稿 Release

---

## 📝 快速操作

### 查看构建状态

```bash
# 访问 GitHub Actions
# https://github.com/xiao-ge008/cherry-studio-magic/actions
```

### 发布 Release

```bash
# 访问 Releases 页面
# https://github.com/xiao-ge008/cherry-studio-magic/releases
```

---

**版本:** 1.7.0-magic
**状态:** ✅ 标签已推送，等待 GitHub Actions 构建
**更新时间:** 2025-11-27 01:02
