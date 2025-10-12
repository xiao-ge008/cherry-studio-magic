import { Card, Switch } from 'antd'
import { FC, useEffect, useState } from 'react'
import styled from 'styled-components'

const Section = styled(Card)`
  margin-bottom: 12px;
`

type Flags = {
  options: boolean
  tts: boolean
  comfyui: boolean
  html: boolean
}

const defaultFlags: Flags = { options: true, tts: true, comfyui: true, html: true }

const storageKey = 'componentSettings'

const ComponentSettings: FC = () => {
  const [flags, setFlags] = useState<Flags>(defaultFlags)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setFlags({ ...defaultFlags, ...JSON.parse(raw) })
    } catch {}
  }, [])

  const update = (partial: Partial<Flags>) => {
    const next = { ...flags, ...partial }
    setFlags(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {}
  }

  return (
    <div style={{ padding: 12 }}>
      <Section title="Options Component">
        <Switch checked={flags.options} onChange={(v) => update({ options: v })} />
      </Section>
      <Section title="TTS Component">
        <Switch checked={flags.tts} onChange={(v) => update({ tts: v })} />
      </Section>
      <Section title="ComfyUI Component">
        <Switch checked={flags.comfyui} onChange={(v) => update({ comfyui: v })} />
      </Section>
      <Section title="HTML Render Component">
        <Switch checked={flags.html} onChange={(v) => update({ html: v })} />
      </Section>
      <p style={{ color: 'var(--color-text-3)' }}>
        Note: current build of Magic edition exposes basic toggles; features are enabled by default.
      </p>
    </div>
  )
}

export default ComponentSettings

