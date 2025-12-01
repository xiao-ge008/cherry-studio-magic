# Cherry Studio Magic（中文）

英文版请见：README.md

Cherry Studio Magic 是官方 Cherry Studio 的精简分支，聚焦“内置、可直接投入生产的组件”，同时简化仓库结构，便于克隆、构建与二次开发。

- 上游项目：https://github.com/CherryHQ/cherry-studio
- 本项目：https://github.com/xiao-ge008/cherry-studio-magic

## 与官方版本的差异

- 默认内置并启用以下组件：
  - 选项组件（Options Component）：在消息中渲染交互式选项（切换/下拉等）
  - TTS 组件（Text‑to‑Speech）：在消息流中内联播放语音
  - ComfyUI 组件：在聊天中预览/运行 ComfyUI 工作流
  - HTML 渲染组件：在消息中安全渲染 HTML（带作用域样式）
- 仓库更轻量：
  - 移除测试、快照与调试样例
  - 文档以生产使用为主，突出扩展方式

## 组件概览

### 选项组件（Options）

在 Markdown/助手消息中嵌入交互选项，实现快速操作与配置。

![Options Component](images/options.png)

### TTS 组件

在助手消息中内联播放语音，支持队列与基本控制。

### ComfyUI 组件

在聊天中集成 ComfyUI 工作流：预览图、触发运行、显示结果。

![ComfyUI Component](images/comfyui.png)

工作流高级预览示例：

![ComfyUI Component (advanced)](images/comfyui2.png)

### HTML 渲染组件

在消息中安全地渲染 HTML，适用于富文本输出。

![HTML Render](images/html-render.png)

## 快速开始

### 依赖要求

- Node.js >= 22（推荐开启 Corepack 使用 Yarn 4）

### 开发运行

yarn install
yarn dev

### 生产构建

yarn build

构建产物位于 `out/`（main、preload、renderer）。

### Windows 打包

yarn build:win:x64

如果需要重建原生模块，请安装 Visual Studio Build Tools（C++ 工作负载）与 Windows SDK。

## 项目结构

- `src/main/` Electron 主进程（IPC、服务、API Server）
- `src/preload/` 预加载脚本（Context Bridge）
- `src/renderer/` React 应用（UI、组件、状态）
- `build/` 图标与打包资源

## 许可协议

沿用上游 Cherry Studio 的许可协议。
