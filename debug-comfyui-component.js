// ComfyUI组件调试脚本
// 在浏览器控制台中运行此脚本来检查组件状态

console.log('=== ComfyUI组件调试信息 ===')

// 辅助函数：获取Redux状态
function getReduxState() {
  if (window.__REDUX_DEVTOOLS_EXTENSION__) {
    return window.__REDUX_DEVTOOLS_EXTENSION__.getState()
  }

  // 尝试从window.store获取
  if (window.store && window.store.getState) {
    return window.store.getState()
  }

  return null
}

// 1. 检查Redux store中的组件设置
const state = getReduxState()

if (state) {
  console.log('1. Redux State中的组件设置:')
  console.log(state.settings?.componentSettings)

  const componentSettings = state.settings?.componentSettings
  if (componentSettings) {
    const comfyUIComponents = Object.values(componentSettings.components || {}).filter(
      (comp) => comp.category === 'comfyui'
    )

    console.log('2. ComfyUI组件列表:')
    comfyUIComponents.forEach((comp) => {
      console.log(`- ${comp.componentName}: ${comp.name} (enabled: ${comp.enabled})`)
      console.log(`  ID: ${comp.id}`)
      console.log(`  服务器: ${comp.serverUrl || '未配置'}`)
      console.log(`  参数数量: ${comp.parameters?.length || 0}`)
    })

    // 检查verticalPainting组件
    const verticalPainting = comfyUIComponents.find((comp) => comp.componentName === 'verticalPainting')
    if (verticalPainting) {
      console.log('3. ✅ verticalPainting组件配置:')
      console.log(verticalPainting)

      // 检查组件配置完整性
      const issues = []
      if (!verticalPainting.enabled) issues.push('组件已禁用')
      if (!verticalPainting.serverUrl) issues.push('缺少服务器URL')
      if (!verticalPainting.workflowTemplate || Object.keys(verticalPainting.workflowTemplate).length === 0) {
        issues.push('缺少工作流模板')
      }
      if (!verticalPainting.parameters || verticalPainting.parameters.length === 0) {
        issues.push('缺少参数配置')
      }

      if (issues.length > 0) {
        console.log('⚠️ 组件配置问题:', issues)
      } else {
        console.log('✅ 组件配置完整')
      }
    } else {
      console.log('3. ❌ verticalPainting组件未找到')
    }
  }
} else {
  console.log('❌ 无法访问Redux状态')
}

// 2. 检查ComponentService
try {
  const componentService =
    window.componentService ||
    (window.require && window.require('@renderer/services/ComponentService').componentService)

  if (componentService) {
    console.log('4. ComponentService可用')
    const comfyUIComponents = componentService.getComfyUIComponents()
    console.log('5. 通过ComponentService获取的ComfyUI组件:')
    comfyUIComponents.forEach((comp) => {
      console.log(`- ${comp.componentName}: ${comp.name} (enabled: ${comp.enabled})`)
    })
  } else {
    console.log('❌ ComponentService不可用')
  }
} catch (error) {
  console.log('❌ 访问ComponentService时出错:', error)
}

// 3. 检查本地存储
console.log('6. 检查localStorage:')
const localStorageKeys = Object.keys(localStorage).filter(
  (key) => key.includes('component') || key.includes('comfyui') || key.includes('settings')
)
localStorageKeys.forEach((key) => {
  console.log(`- ${key}:`, localStorage.getItem(key))
})

// 4. 检查网络请求
console.log('7. 检查ComfyUI API端点:')
fetch('/api/v1/comfyui/components')
  .then((response) => {
    console.log('ComfyUI API响应状态:', response.status)
    return response.json()
  })
  .then((data) => {
    console.log('ComfyUI API响应数据:', data)
  })
  .catch((error) => {
    console.log('❌ ComfyUI API请求失败:', error)
  })

console.log('=== 调试信息结束 ===')
