# ComfyUI URL请求使用指南

## 📋 概述

Cherry Studio现在支持两种方式使用ComfyUI组件：
1. **传统组件标签方式** - 在Markdown中使用`<comfyui-xxx>`标签
2. **URL直接请求方式** - 使用`comfy-xxx`格式的URL直接生成内容

## 🎯 两种使用方式对比

### 方式1：传统组件标签（现有方式）

**适用场景**：LLM对话中的动态组件渲染

**使用格式**：
```markdown
<comfyui-text2image prompt="beautiful landscape" steps="20" cfg="7.5" />
<comfyui-video-gen prompt="sunset over mountains" duration="5" />
<comfyui-style-transfer input="photo.jpg" style="oil-painting" />
```

**特点**：
- ✅ 支持实时进度显示
- ✅ 完整的错误处理和重试机制
- ✅ 与LLM对话完美集成
- ✅ 支持参数表单和交互式生成
- ❌ 只能在Cherry Studio内部使用
- ❌ 无法在外部HTML/应用中使用

### 方式2：URL直接请求（新增方式）

**适用场景**：HTML、外部应用、直接URL访问

**使用格式**：
```html
<!-- 图片生成 - 简短格式 -->
<img src="comfy-text2image?prompt=beautiful%20landscape&steps=20&cfg=7.5" alt="Generated Image" />

<!-- 图片生成 - 完整格式 -->
<img src="comfyui-verticalPainting?prompt=masterpiece%2C%20best%20quality%2C%20anime%20style" alt="Anime Portrait" />

<!-- 视频生成 -->
<video src="comfy-video-gen?prompt=sunset&duration=5" controls></video>

<!-- 文字生成 -->
<iframe src="comfyui-story-gen?prompt=write%20a%20poem&style=haiku"></iframe>
```

**特点**：
- ✅ 可在任何HTML环境中使用
- ✅ 支持直接URL访问
- ✅ 完整的缓存机制
- ✅ 支持多媒体类型（图片、视频、文字）
- ❌ 无实时进度显示
- ❌ 错误处理相对简单

## 📝 生成MD使用指南

### 场景1：LLM对话中生成交互式MD

**适用场景**：在Cherry Studio内部对话，需要交互式组件

**提示词示例**：
```
请生成一个包含二次元立绘的Markdown文档，要求用户可以交互修改参数
```

**生成的MD格式**：
```markdown
<comfyui-verticalPainting
  prompt="masterpiece, best quality, anime style, 1girl"
  steps="25"
  cfg="7.5"
/>
```

**特点**：
- ✅ 支持参数表单和实时修改
- ✅ 显示生成进度和状态
- ✅ 完整的错误处理
- ❌ 仅在Cherry Studio内有效

### 场景2：生成可外部使用的MD

**适用场景**：需要在GitHub、博客、文档站点等外部平台使用

**提示词示例**：
```
请生成一个包含AI图片的Markdown文档，要求可以在GitHub等外部平台正常显示
```

**生成的MD格式**：
```markdown
![二次元立绘](comfyui-verticalPainting?prompt=masterpiece%2C%20best%20quality%2C%20anime%20style%2C%201girl&steps=25&cfg=7.5)
```

**特点**：
- ✅ 可在任何支持图片的Markdown环境使用
- ✅ 自动缓存，加载速度快
- ✅ URL格式简洁明了
- ❌ 无交互功能，参数固定

### 使用建议

| 使用场景 | 推荐方式 | 格式示例 |
|---------|---------|----------|
| Cherry Studio内部对话 | 组件标签 | `<comfyui-xxx>` |
| 外部Markdown文档 | URL图片 | `![](comfyui-xxx?...)` |
| HTML页面嵌入 | URL图片/视频 | `<img src="comfyui-xxx?...">` |
| 技术文档 | 混合使用 | 根据需要选择 |

## 🔧 URL请求方式详细说明

### URL格式规范

支持两种URL格式：

**格式1：简短格式**
```
comfy-{componentName}?param1=value1&param2=value2&param3=value3
```

**格式2：完整格式**
```
comfyui-{componentName}?param1=value1&param2=value2&param3=value3
```

**参数说明**：
- `componentName`: 组件的英文名称（在组件设置中定义）
- 查询参数：组件所需的参数，需要进行URL编码

**选择建议**：
- 如果组件名较短，推荐使用`comfy-`格式
- 如果需要与现有组件标签保持一致，使用`comfyui-`格式

### 参数类型转换

系统会自动进行参数类型转换：

| 输入值 | 转换结果 | 类型 |
|--------|----------|------|
| `"123"` | `123` | number |
| `"12.5"` | `12.5` | number |
| `"true"` | `true` | boolean |
| `"false"` | `false` | boolean |
| `'{"key":"value"}'` | `{key: "value"}` | object |
| `"hello%20world"` | `"hello world"` | string |

### 输出类型支持

根据组件的`outputType`配置，系统返回不同类型的内容：

#### 图片类型 (outputType: 'image')
```html
<img src="comfy-anime-portrait?style=cute&character=girl" alt="Generated Portrait" />
```
**返回**：图片文件（PNG/JPEG/WebP等）

#### 视频类型 (outputType: 'video')
```html
<video src="comfy-video-gen?prompt=dancing&style=anime" controls>
  您的浏览器不支持视频播放
</video>
```
**返回**：视频文件（MP4/WebM等）

#### 文字类型 (outputType: 'text')
```html
<iframe src="comfy-story-gen?theme=adventure&length=short" width="100%" height="300">
</iframe>
```
**返回**：纯文本内容

## 💡 实际使用示例

### 示例1：在LLM对话中生成MD（传统方式）

当您在Cherry Studio的对话中需要AI生成包含ComfyUI组件的Markdown时：

**用户提示**：
```
请生成一个包含二次元立绘的文档，要求生成一个可爱的女孩形象
```

**AI生成的MD内容**：
```markdown
# 二次元立绘展示

这是一个可爱的二次元女孩立绘：

<comfyui-verticalPainting
  prompt="masterpiece, best quality, anime style, 1girl, cute, smile, school uniform"
  steps="25"
  cfg="7.5"
/>

这个组件会在Cherry Studio中渲染为交互式的生成界面，用户可以：
- 修改参数
- 查看生成进度
- 重新生成
- 保存结果
```

### 示例2：生成可在外部使用的MD（URL方式）

当您需要生成可以在任何Markdown渲染器中使用的内容时：

**用户提示**：
```
请生成一个包含AI图片的Markdown文档，要求可以在GitHub、博客等外部平台使用
```

**AI生成的MD内容**：
```markdown
# AI艺术作品展示

## 二次元立绘

![可爱的二次元女孩](comfyui-verticalPainting?prompt=masterpiece%2C%20best%20quality%2C%20anime%20style%2C%201girl%2C%20cute%2C%20smile&steps=25&cfg=7.5)

## 风景画

![印象派风景](comfy-landscape?style=impressionist&time=sunset&elements=mountains%2Clake&steps=20)

## 人物肖像

![写实人物](comfy-portrait?style=photorealistic&age=young&gender=female&mood=happy)

这些图片会在支持Cherry Studio URL格式的环境中自动生成和显示。
```

### 示例3：博客文章中嵌入AI生成图片

```html
<!DOCTYPE html>
<html>
<head>
    <title>我的博客</title>
</head>
<body>
    <h1>AI艺术创作</h1>
    <p>这是一张AI生成的二次元立绘：</p>

    <!-- 使用完整格式，与组件标签保持一致 -->
    <img src="comfyui-verticalPainting?prompt=masterpiece%2C%20best%20quality%2C%20anime%20style%2C%201girl"
         alt="AI生成的二次元立绘"
         style="width: 100%; max-width: 600px;" />

    <p>这张图片是实时生成的，每次刷新都可能不同！</p>
</body>
</html>
```

### 示例2：动态参数生成

```javascript
// JavaScript中动态构建URL
function generateArtwork(style, subject, mood) {
    const params = new URLSearchParams({
        style: style,
        subject: subject,
        mood: mood,
        quality: 'high',
        steps: '30'
    })

    const imageUrl = `comfy-artwork?${params.toString()}`
    document.getElementById('artwork').src = imageUrl
}

// 使用示例
generateArtwork('anime', 'cat', 'playful')
```

### 示例3：Markdown文档中使用

```markdown
# AI内容展示

## 生成的图片
![AI风景画](comfy-landscape?style=realistic&season=spring&weather=sunny)

## 生成的故事
以下是AI创作的短篇故事：

<iframe src="comfy-story?genre=fantasy&length=500&protagonist=wizard"
        width="100%" height="400" frameborder="0">
</iframe>
```

### 示例4：React组件中使用

```jsx
import React, { useState } from 'react'

function AIImageGenerator() {
    const [prompt, setPrompt] = useState('')
    const [imageUrl, setImageUrl] = useState('')

    const generateImage = () => {
        const params = new URLSearchParams({
            prompt: prompt,
            steps: '25',
            cfg: '7.5',
            style: 'photorealistic'
        })

        // 可以选择使用简短格式或完整格式
        setImageUrl(`comfy-photo?${params.toString()}`)
        // 或者: setImageUrl(`comfyui-verticalPainting?${params.toString()}`)
    }

    return (
        <div>
            <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="输入图片描述..."
            />
            <button onClick={generateImage}>生成图片</button>

            {imageUrl && (
                <img src={imageUrl} alt="Generated" style={{maxWidth: '100%'}} />
            )}
        </div>
    )
}
```

## 📝 在Markdown中生成使用说明

当您需要在Markdown文档中说明ComfyUI组件的使用方法时，现在可以提供两种方式：

### 方式1：传统组件标签使用说明

```markdown
## 使用ComfyUI组件生成图片

在对话中使用以下标签格式：

\`\`\`markdown
<comfyui-verticalPainting prompt="masterpiece, best quality, anime style, 1girl" />
\`\`\`

**参数说明**：
- `prompt`: 图片描述提示词
- `steps`: 生成步数（可选，默认20）
- `cfg`: CFG值（可选，默认7.5）

**特点**：
- ✅ 支持实时进度显示
- ✅ 完整的错误处理
- ✅ 参数表单交互
- ❌ 仅限Cherry Studio内部使用
```

### 方式2：URL请求使用说明

```markdown
## 使用URL直接生成图片

在HTML或任何支持图片的环境中使用：

\`\`\`html
<!-- 完整格式（推荐用于现有组件） -->
<img src="comfyui-verticalPainting?prompt=masterpiece%2C%20best%20quality%2C%20anime%20style%2C%201girl"
     alt="AI生成图片" />

<!-- 简短格式 -->
<img src="comfy-text2image?prompt=beautiful%20landscape&steps=20&cfg=7.5"
     alt="AI生成图片" />
\`\`\`

**URL格式**：
- `comfyui-{组件名}?参数1=值1&参数2=值2`
- `comfy-{组件名}?参数1=值1&参数2=值2`

**特点**：
- ✅ 可在任何HTML环境使用
- ✅ 支持直接URL访问
- ✅ 完整缓存机制
- ❌ 无实时进度显示
```

### 完整的Markdown使用示例

```markdown
# AI图片生成指南

## 方法一：在Cherry Studio对话中使用

直接在对话中输入组件标签：

<comfyui-verticalPainting prompt="masterpiece, best quality, anime style, 1girl, maid headdress, bare chest, kneeling, torn black thighhighs, blush" />

## 方法二：在网页或文档中使用

将以下HTML代码嵌入到您的网页中：

\`\`\`html
<img src="comfyui-verticalPainting?prompt=masterpiece%2C%20best%20quality%2C%20anime%20style%2C%201girl%2C%20maid%20headdress%2C%20bare%20chest%2C%20kneeling%2C%20torn%20black%20thighhighs%2C%20blush"
     alt="AI生成的二次元立绘"
     style="max-width: 100%; height: auto;" />
\`\`\`

## 参数说明

| 参数名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| prompt | string | 图片描述提示词 | "anime girl, cute" |
| steps | number | 生成步数 | 20 |
| cfg | number | CFG引导强度 | 7.5 |

## 注意事项

1. **URL编码**：在URL中使用时，特殊字符需要编码（如空格变为%20，逗号变为%2C）
2. **缓存机制**：相同参数的请求会使用缓存，提高响应速度
3. **兼容性**：URL方式可在任何支持HTML的环境中使用
```

## ⚡ 性能优化

### 缓存机制
- 相同参数的请求会自动使用缓存
- 缓存有效期30天
- 最多缓存1000个文件

### 最佳实践
1. **参数稳定性**：尽量使用稳定的参数组合以提高缓存命中率
2. **URL编码**：确保特殊字符正确编码
3. **错误处理**：为图片/视频元素添加错误处理
4. **加载状态**：考虑添加加载指示器

```html
<img src="comfy-portrait?style=anime&mood=happy"
     alt="AI Portrait"
     onload="hideLoading()"
     onerror="showError()"
     style="display: none;" />
<div id="loading">生成中...</div>
```

## 🔍 故障排除

### 常见问题

**Q: 图片无法显示**
A: 检查组件名称是否正确，参数是否完整

**Q: 生成速度慢**
A: 首次生成需要时间，后续相同参数会使用缓存

**Q: 参数不生效**
A: 确保参数名称与组件配置中的参数名完全一致

**Q: 特殊字符问题**
A: 使用`encodeURIComponent()`对参数值进行编码

### 调试方法

1. **检查组件配置**：确认组件已启用且配置正确
2. **验证参数**：在Cherry Studio中先用组件标签测试
3. **查看日志**：检查开发者工具的网络面板
4. **测试缓存**：清除缓存后重试

## 🎉 总结

URL请求方式为ComfyUI组件提供了更广泛的使用场景，让AI生成内容可以轻松集成到任何Web应用中。结合传统的组件标签方式，Cherry Studio现在提供了完整的AI内容生成解决方案。

选择使用方式的建议：
- **LLM对话场景**：使用组件标签方式生成交互式MD
- **外部集成场景**：使用URL请求方式生成通用MD
- **混合场景**：两种方式结合使用

## 🎯 生成MD的两种方式总结

### 方式1：交互式MD生成（组件标签）
```markdown
<!-- LLM生成的交互式内容 -->
<comfyui-verticalPainting prompt="anime girl" steps="25" />
```
- ✅ 用户可修改参数
- ✅ 实时进度显示
- ✅ 完整错误处理
- 🎯 **适用**：Cherry Studio内部对话

### 方式2：通用MD生成（URL图片）
```markdown
<!-- LLM生成的通用内容 -->
![AI立绘](comfyui-verticalPainting?prompt=anime%20girl&steps=25)
```
- ✅ 任何Markdown环境可用
- ✅ 自动缓存优化
- ✅ 简洁URL格式
- 🎯 **适用**：外部平台、文档、博客

## 🛠️ 技术实现细节

### 请求拦截机制

Cherry Studio使用Electron的`webRequest` API拦截`comfy-*`格式的URL：

```typescript
// 拦截器设置
session.webRequest.onBeforeRequest(
  { urls: ['*://*/comfy-*', 'file://*/comfy-*'] },
  async (details, callback) => {
    const result = await handleComfyUIRequest(details.url)
    if (result.success) {
      callback({ redirectURL: `file://${result.filePath}` })
    } else {
      callback({ cancel: true })
    }
  }
)
```

### 组件查找流程

1. **URL解析**：提取组件名和参数
2. **组件查找**：在已注册组件中查找匹配项
3. **参数验证**：检查必需参数和类型
4. **缓存检查**：查看是否有缓存结果
5. **内容生成**：调用ComfyUI服务生成内容
6. **结果返回**：根据输出类型返回相应内容

### 安全考虑

- **参数大小限制**：单次请求参数不超过10KB
- **组件名验证**：只允许字母、数字、连字符和下划线
- **路径安全**：防止路径遍历攻击
- **请求超时**：60秒超时保护

### 扩展性设计

系统设计支持未来扩展：
- **新输出类型**：可轻松添加音频、3D模型等类型
- **自定义协议**：支持`comfyui://`协议
- **批量请求**：支持一次请求生成多个内容
- **流式输出**：支持实时流式内容生成

这种双模式设计让Cherry Studio的ComfyUI功能既保持了原有的强大交互性，又获得了广泛的集成能力！
