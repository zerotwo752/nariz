import { Routes, Route, Navigate } from "react-router-dom";

// PAGES USUARIO
import Home from "./pages/Home";
import Apuestas from "./pages/Apuestas";
import Recargas from "./pages/Recargas";
import Retiros from "./pages/Retiros";
import Inversion from "./pages/Inversion";
import Cuenta from "./pages/Cuenta";
import Login from "./pages/Login";
import Register from "./pages/Register";

// ADMIN PAGES
import PanelRecargas from "./pages/PanelRecargas";
import PanelInversiones from "./pages/PanelInversiones";
import PanelApuestas from "./pages/PanelApuestas";
import PanelRetiros from "./pages/PanelRetiros";   // <<< NUEVO IMPORT

// ROUTES
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";

function App() {
  return (
    <Routes>
      {/* PÚBLICAS */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* USUARIO */}
      <Route
        path="/home"
        element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        }
      />

      <Route
        path="/cuenta"
        element={
          <PrivateRoute>
            <Cuenta />
          </PrivateRoute>
        }
      />

      <Route
        path="/recargas"
        element={
          <PrivateRoute>
            <Recargas />
          </PrivateRoute>
        }
      />

      <Route
        path="/retiros"
        element={
          <PrivateRoute>
            <Retiros />
          </PrivateRoute>
        }
      />

      <Route
        path="/inversion"
        element={
          <PrivateRoute>
            <Inversion />
          </PrivateRoute>
        }
      />

      <Route
        path="/apuestas"
        element={
          <PrivateRoute>
            <Apuestas />
          </PrivateRoute>
        }
      />

      {/* ADMIN */}
      <Route
        path="/admin/recargas"
        element={
          <AdminRoute>
            <PanelRecargas />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/inversiones"
        element={
          <AdminRoute>
            <PanelInversiones />
          </AdminRoute>
        }
      />

      <Route
        path="/admin/apuestas"
        element={
          <AdminRoute>
            <PanelApuestas />
          </AdminRoute>
        }
      />

      {/* NUEVO PANEL DE RETIROS */}
      <Route
        path="/admin/retiros"
        element={
          <AdminRoute>
            <PanelRetiros />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

export default App;
