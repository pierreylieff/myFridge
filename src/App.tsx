import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { FullScreenLoader } from './components/common'
import Login from './screens/Login'
import Signup from './screens/Signup'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import AddEditItem from './screens/AddEditItem'
import Scanner from './screens/Scanner'
import ScanResults from './screens/ScanResults'
import Settings from './screens/Settings'
import Recipes from './screens/Recipes'
import RecipeDetail from './screens/RecipeDetail'
import ImportRecipe from './screens/ImportRecipe'
import Placeholder from './screens/Placeholder'

// Gate for authenticated routes. Redirects to login or onboarding as needed.
function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth()
  if (loading) return <FullScreenLoader label="myFridge" />
  if (!session) return <Navigate to="/login" replace />
  if (profile && !profile.onboarding_done) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

// Auth screens redirect to home when already signed in.
function PublicOnly({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth()
  if (loading) return <FullScreenLoader label="myFridge" />
  if (session) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/onboarding" element={<Onboarding />} />

      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/item/:id" element={<RequireAuth><AddEditItem /></RequireAuth>} />
      <Route path="/scanner" element={<RequireAuth><Scanner /></RequireAuth>} />
      <Route path="/scan/results" element={<RequireAuth><ScanResults /></RequireAuth>} />
      <Route path="/profil" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="/recettes" element={<RequireAuth><Recipes /></RequireAuth>} />
      <Route path="/recettes/import" element={<RequireAuth><ImportRecipe /></RequireAuth>} />
      <Route path="/recettes/:id" element={<RequireAuth><RecipeDetail /></RequireAuth>} />
      <Route
        path="/planning"
        element={
          <RequireAuth>
            <Placeholder title="Planning" emoji="📅" text="Planifiez vos repas de la semaine ici (prévu après le MVP)." />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
