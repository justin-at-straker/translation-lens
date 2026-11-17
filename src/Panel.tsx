// Lens settings. Every control is a ui-sdk component with a clear label, so
// the agent bridge can read and change each one by name. A control the agent
// just changed gets an AGENT tag and an accent ring for a few seconds.
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { Input } from "@ui-sdk/react/input"
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/react/select"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@ui-sdk/react/slider"
import { Switch, SwitchThumb } from "@ui-sdk/react/switch"
import { useRef, useState, type ReactNode } from "react"
import { LANGUAGES, type Language, type LensSettings, type Tone } from "./settings"

type Key = keyof LensSettings
type Props = { settings: LensSettings; onChange: (patch: Partial<LensSettings>) => void }
type Details = { source?: string }

function useAgentMarks() {
  const [marked, setMarked] = useState<Set<Key>>(new Set())
  const timers = useRef(new Map<Key, number>())
  const mark = (key: Key, details?: Details) => {
    if (details?.source !== "agent") return
    setMarked((m) => new Set(m).add(key))
    window.clearTimeout(timers.current.get(key))
    timers.current.set(
      key,
      window.setTimeout(() => {
        setMarked((m) => {
          const next = new Set(m)
          next.delete(key)
          return next
        })
      }, 4000),
    )
  }
  return { marked, mark }
}

function Row({ label, agent, children }: { label: ReactNode; agent: boolean; children: ReactNode }) {
  return (
    <div className={`row${agent ? " row-agent" : ""}`}>
      <div className="row-head">
        {label}
        {agent && <span className="agent-tag">AGENT</span>}
      </div>
      {children}
    </div>
  )
}

function SliderRow(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  agent: boolean
  onChange: (v: number, d: Details) => void
}) {
  return (
    <Field>
      <Row
        label={
          <span className="row-split">
            <FieldLabel>{props.label}</FieldLabel>
            <span className="row-value">{props.format(props.value)}</span>
          </span>
        }
        agent={props.agent}
      >
        <Slider
          value={props.value}
          min={props.min}
          max={props.max}
          step={props.step}
          onValueChange={(v, d) => props.onChange(v as number, d as Details)}
        >
          <SliderControl className="slider">
            <SliderTrack className="slider-track">
              <SliderIndicator className="slider-fill" />
              <SliderThumb className="slider-thumb" />
            </SliderTrack>
          </SliderControl>
        </Slider>
      </Row>
    </Field>
  )
}

export function Panel({ settings, onChange }: Props) {
  const { marked, mark } = useAgentMarks()
  const set = <K extends Key>(key: K, value: LensSettings[K], d?: Details) => {
    mark(key, d)
    onChange({ [key]: value } as Partial<LensSettings>)
  }

  return (
    <section className="panel" aria-label="Lens settings">
      <h2 className="panel-title">Lens</h2>

      <Field>
        <Row label={<FieldLabel>Target language</FieldLabel>} agent={marked.has("language")}>
          <Select
            value={settings.language}
            onValueChange={(v: unknown, d: unknown) => v && set("language", v as Language, d as Details)}
          >
            <SelectTrigger className="select-trigger">
              <SelectValue />
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 4.5l3 3 3-3" />
              </svg>
            </SelectTrigger>
            <SelectContent className="select-content">
              {Object.entries(LANGUAGES).map(([value, label]) => (
                <SelectItem key={value} value={value} className="select-item">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      </Field>

      <Row label={<span className="row-label">Tone</span>} agent={marked.has("tone")}>
        <SegmentedControl
          aria-label="Tone"
          className="segmented"
          value={settings.tone}
          onValueChange={(v, d) => v && set("tone", v as Tone, d as Details)}
        >
          <SegmentedControlIndicator className="segmented-indicator" />
          <SegmentedControlItem value="neutral">Neutral</SegmentedControlItem>
          <SegmentedControlItem value="formal">Formal</SegmentedControlItem>
          <SegmentedControlItem value="casual">Casual</SegmentedControlItem>
        </SegmentedControl>
      </Row>

      <Field>
        <Row label={<FieldLabel>Do not translate</FieldLabel>} agent={marked.has("keep")}>
          <Input
            className="text-input"
            value={settings.keep}
            placeholder="Brand names, comma separated"
            onValueChange={(v, d) => set("keep", v, d as Details)}
          />
        </Row>
      </Field>

      <SliderRow
        label="Lens size"
        value={settings.size}
        min={80}
        max={260}
        step={5}
        format={(v) => `${v} px`}
        agent={marked.has("size")}
        onChange={(v, d) => set("size", v, d)}
      />
      <SliderRow
        label="Magnification"
        value={settings.magnify}
        min={1}
        max={1.6}
        step={0.02}
        format={(v) => `${v.toFixed(2)}×`}
        agent={marked.has("magnify")}
        onChange={(v, d) => set("magnify", v, d)}
      />

      <label className={`row switch-row${marked.has("refraction") ? " row-agent" : ""}`}>
        <span className="row-label">Edge refraction</span>
        <Switch
          className="switch"
          checked={settings.refraction}
          onCheckedChange={(v, d) => set("refraction", v, d as Details)}
        >
          <SwitchThumb className="switch-thumb" />
        </Switch>
      </label>
    </section>
  )
}
