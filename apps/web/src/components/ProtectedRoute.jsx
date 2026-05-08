import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function ProtectedRoute({
  children,
  roles = null,
  requireFreshPassword = false,
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="centered-screen">Validando acceso...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword && requireFreshPassword) {
    return <Navigate to="/cambiar-pin" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

