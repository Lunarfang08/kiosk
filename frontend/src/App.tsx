import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { api } from '@/services/api'
import { AvatarStudio } from '@/pages/AvatarStudio'
import { DiagnosticsPage } from '@/pages/DiagnosticsPage'
import { KioskPage } from '@/pages/KioskPage'
import { SettingsPage } from '@/pages/SettingsPage'
import type { AvatarConfig } from '@/stores/avatarStore'
import { useAvatarStore } from '@/stores/avatarStore'

export default function App() {
  const setAvatars = useAvatarStore((s) => s.setAvatars)

  useEffect(() => {
    void api
      .avatars()
      .then((list) => setAvatars(list as AvatarConfig[]))
      .catch(() => undefined)
  }, [setAvatars])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<KioskPage />} />
        <Route path="/studio" element={<AvatarStudio />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/diagnostics" element={<DiagnosticsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
