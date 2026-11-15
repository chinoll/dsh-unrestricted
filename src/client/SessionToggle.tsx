import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { UnrestrictedSettings } from './controller.ts'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

export interface SessionToggleInjected {
  sessionId: string
  settings: ConfigForm<UnrestrictedSettings>
  read: () => Promise<boolean>
}

type Props = PropsRuntime<'conversation.input.left'> & PropsLocale<'settings.unrestricted'> & InjectFace<SessionToggleInjected>

/** A new mounted state for each session also isolates late writes and reads. */
export function SessionToggle(props: Props) {
  return <SessionToggleState key={props.sessionId} {...props} />
}

function SessionToggleState({ sessionId, settings, read, t }: Props) {
  const config = useSyncExternalStore(settings.subscribe.bind(settings), settings.getSnapshot.bind(settings))
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [readError, setReadError] = useState(false)
  const [retryTarget, setRetryTarget] = useState<boolean | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let current = true
    if (config.status !== 'ready') { setEnabled(null); return }
    read().then(value => { if (current) { setEnabled(value); setReadError(false) } })
      .catch(() => { if (current) setReadError(true) })
    return () => { current = false }
  }, [read, config.value, config.status, refresh])

  async function toggle() {
    if (busy) return
    if (enabled === null || readError && retryTarget === null) { setReadError(false); setRefresh(value => value + 1); return }
    const target = retryTarget ?? !enabled
    setBusy(true)
    setReadError(false)
    try {
      const accepted = await settings.mutate([{ op: 'set', path: ['sessions', sessionId], value: target }])
      if (!accepted) throw new Error('Write refused')
      setEnabled(target)
      setRetryTarget(null)
    } catch {
      setRetryTarget(target)
    } finally { setBusy(false) }
  }

  const error = !busy && (readError || retryTarget !== null)
  const unavailable = config.status === 'unavailable'
  const readOnly = config.status === 'ready' && !config.writable
  const label = unavailable ? t('sessionUnavailable') : error ? t('sessionRetry') : busy ? t('sessionSaving') : enabled === null
    ? t('sessionLoading') : enabled ? t('sessionOn') : t('sessionOff')
  const hint = unavailable ? t('sessionUnavailableHint') : readOnly ? t('sessionReadOnly')
    : error ? t(retryTarget === null ? 'sessionReadError' : 'sessionError') : t('sessionHint')
  return <button type="button" role="switch" aria-checked={enabled === true}
    aria-busy={!unavailable && (busy || enabled === null && !error)}
    aria-label={unavailable || readOnly ? `${label} (${hint})` : error ? hint : label} title={hint}
    className="dsh-unrestricted-sessionButton"
    data-enabled={enabled === true} data-error={error}
    disabled={busy || !config.writable || config.status !== 'ready' || enabled === null && !error}
    onClick={() => { void toggle() }}>
    <span aria-hidden="true">{enabled ? '●' : '○'}</span>
    <span aria-live="polite">{label}</span>
  </button>
}
