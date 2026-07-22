import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { RequireAdmin } from '@/components/guards/RequireAdmin'
import { AppLayout } from '@/components/layout/AppLayout'
import { UserLayout } from '@/components/layout/UserLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UsersPage } from '@/pages/UsersPage'
import { ScholarScraperPage } from '@/pages/ScholarScraperPage'
import { BioxbioCrawlerPage } from '@/pages/BioxbioCrawlerPage'
import { ScimagoCrawlerPage } from '@/pages/ScimagoCrawlerPage'
import { ClarivateCrawlerPage } from '@/pages/ClarivateCrawlerPage'
import { ScoreIntegratorPage } from '@/pages/ScoreIntegratorPage'
import { ProfileManagerPage } from '@/pages/ProfileManagerPage'
import { UnifiedCrawlerPage } from '@/pages/UnifiedCrawlerPage'
import { ScholarAutoSchedulerPage } from '@/pages/ScholarAutoSchedulerPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { DatabasePage } from '@/pages/DatabasePage'
import { HelpPage } from '@/pages/HelpPage'
import { UserPortalPage } from '@/pages/UserPortalPage'

import { useAuthStore } from '@/stores/auth.store'

function FallbackRedirect() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.is_staff || user?.is_superuser
  return <Navigate to={isAdmin ? '/' : '/portal'} replace />
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      // User Portal Layout
      {
        element: <UserLayout />,
        children: [{ path: '/portal', element: <UserPortalPage /> }],
      },
      // Admin Protected Routes
      {
        element: <RequireAdmin />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/scholar/unified', element: <UnifiedCrawlerPage /> },
              { path: '/scholar/auto-scheduler', element: <ScholarAutoSchedulerPage /> },
              { path: '/scholar/scraper', element: <ScholarScraperPage /> },
              { path: '/scholar/bioxbio', element: <BioxbioCrawlerPage /> },
              { path: '/scholar/scimago', element: <ScimagoCrawlerPage /> },
              { path: '/scholar/clarivate', element: <ClarivateCrawlerPage /> },
              { path: '/scholar/integrator', element: <ScoreIntegratorPage /> },
              { path: '/scholar/profiles', element: <ProfileManagerPage /> },
              { path: '/users', element: <UsersPage /> },
              { path: '/settings', element: <SettingsPage /> },
              { path: '/database', element: <DatabasePage /> },
              { path: '/help', element: <HelpPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <FallbackRedirect /> },
])
