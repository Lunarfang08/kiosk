import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'

type Settings = {
  dograh_base_url: string
  dograh_agent_id: string
  has_api_key: boolean
  has_embed_token: boolean
  avatar_engine: string
  livetalking_enabled: boolean
  livetalking_base_url: string
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<Record<string, unknown> | null>(null)
  const [token, setToken] = useState(localStorage.getItem('kiosk_admin_token') || '')
  const [apiKey, setApiKey] = useState('')
  const [embedToken, setEmbedToken] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://app.dograh.com')
  const [agentId, setAgentId] = useState('14591')
  const [message, setMessage] = useState('')

  const load = async () => {
    const s = (await api.settings()) as Settings
    setSettings(s)
    setBaseUrl(s.dograh_base_url)
    setAgentId(s.dograh_agent_id)
    const st = (await api.dograhStatus()) as Record<string, unknown>
    setStatus(st)
  }

  useEffect(() => {
    void load().catch((e) => setMessage(String(e)))
  }, [])

  const save = async () => {
    localStorage.setItem('kiosk_admin_token', token)
    try {
      const body: Record<string, unknown> = {
        dograh_base_url: baseUrl,
        dograh_agent_id: agentId,
      }
      if (apiKey.trim()) body.dograh_api_key = apiKey.trim()
      if (embedToken.trim()) body.dograh_embed_token = embedToken.trim()
      await api.updateSettings(body)
      setApiKey('')
      setEmbedToken('')
      setMessage('Settings saved on server (secrets stay server-side).')
      await load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  const test = async () => {
    localStorage.setItem('kiosk_admin_token', token)
    try {
      const res = (await api.dograhTest()) as { ok: boolean; message: string }
      setMessage(res.ok ? `OK — ${res.message}` : `Failed — ${res.message}`)
      await load()
    } catch (e) {
      setMessage(String(e))
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-5 py-8">
      <Link to="/" className="text-sm text-[var(--color-muted)] hover:text-ink">
        ← Kiosk
      </Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
        Settings
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Dograh credentials are stored on the backend only. Never put API keys in the browser
        bundle.
      </p>

      <div className="mt-8 space-y-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <label className="block text-sm">
          Admin token (for saving settings)
          <input
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Dograh base URL
          <input
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Agent / workflow ID
          <input
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          API key {settings?.has_api_key ? '(set — leave blank to keep)' : '(not set)'}
          <input
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="dgr_…"
          />
        </label>
        <label className="block text-sm">
          Embed token {settings?.has_embed_token ? '(set)' : '(optional)'}
          <input
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3"
            type="password"
            value={embedToken}
            onChange={(e) => setEmbedToken(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={() => void save()}>Save</Button>
          <Button variant="secondary" onClick={() => void test()}>
            Test connection
          </Button>
          <Link to="/">
            <Button variant="ghost">Test conversation on kiosk</Button>
          </Link>
        </div>
      </div>

      {status && (
        <pre className="mt-6 overflow-auto rounded-2xl border border-[var(--color-line)] bg-black/30 p-4 text-xs text-[var(--color-muted)]">
          {JSON.stringify(status, null, 2)}
        </pre>
      )}
      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  )
}
