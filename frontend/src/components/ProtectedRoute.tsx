import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, allow }: { children: JSX.Element; allow: Array<'admin'|'teacher'|'student'> }){
  const userRaw = localStorage.getItem('user')
  if (!userRaw) return <Navigate to="/login" replace />
  const user = JSON.parse(userRaw)
  if (!allow.includes(user.role)) return <Navigate to="/dashboard" replace />
  return children
}


