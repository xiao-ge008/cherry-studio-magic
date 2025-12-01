import fetch from 'node-fetch'

async function testCliIntegration() {
  const baseUrl = 'http://127.0.0.1:3000/v1/cli'

  console.log('Starting CLI Integration Test...')

  // Test Gemini CLI
  try {
    console.log('\nTesting Gemini CLI...')
    const geminiResponse = await fetch(`${baseUrl}/gemini/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello from test script' }],
        stream: false
      })
    })

    if (geminiResponse.ok) {
      const data = await geminiResponse.json()
      console.log('Gemini CLI Response:', JSON.stringify(data, null, 2))
    } else {
      console.error('Gemini CLI Failed:', await geminiResponse.text())
    }
  } catch (error) {
    console.error('Gemini CLI Error:', error)
  }

  // Test Qwen CLI
  try {
    console.log('\nTesting Qwen CLI...')
    const qwenResponse = await fetch(`${baseUrl}/qwen/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello from test script' }],
        stream: false
      })
    })

    if (qwenResponse.ok) {
      const data = await qwenResponse.json()
      console.log('Qwen CLI Response:', JSON.stringify(data, null, 2))
    } else {
      console.error('Qwen CLI Failed:', await qwenResponse.text())
    }
  } catch (error) {
    console.error('Qwen CLI Error:', error)
  }
}

testCliIntegration()
