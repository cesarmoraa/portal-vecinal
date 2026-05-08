import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { ForcePinChangePage } from "./pages/ForcePinChangePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { NeighborDashboardPage } from "./pages/NeighborDashboardPage.jsx";
import { TreasurerDashboardPage } from "./pages/TreasurerDashboardPage.jsx";
import { AdminDashboardPage } from "./pages/AdminDashboardPage.jsx";

function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="centered-screen">Cargando sesión...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/cambiar-pin" replace />;
  }

  if (user.role === "vecino") {
    return <Navigate to="/vecino" replace />;
  }

  if (user.role === "tesorero") {
    return <Navigate to="/tesorero" replace />;
  }

  return <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/cambiar-pin"
        element={
          <ProtectedRoute>
            <ForcePinChangePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vecino"
        element={
          <ProtectedRoute roles={["vecino"]} requireFreshPassword>
            <NeighborDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tesorero"
        element={
          <ProtectedRoute roles={["tesorero"]} requireFreshPassword>
            <TreasurerDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]} requireFreshPassword>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

