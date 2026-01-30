import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL;

export default function PanelRecargas() {
  const [recargas, setRecargas] = useState([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // =========================
  // CARGAR RECARGAS (ADMIN)
  // =========================
  const cargarRecargas = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/recargas`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        setError("No se pudieron cargar las recargas");
        return;
      }

      setRecargas(data);
    } catch (err) {
      console.error(err);
      setError("Error cargando recargas");
    }
  };

  useEffect(() => {
    cargarRecargas();
  }, []);

  // =========================
  // CAMBIAR ESTADO
  // =========================
  const cambiarStatus = async (id, nuevoStatus) => {
    try {
      const token = localStorage.getItem("token");

      await fetch(`${import.meta.env.VITE_API_URL}/recargas/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nuevoStatus }),
      });

      cargarRecargas();
    } catch (err) {
      console.error(err);
    }
  };

  if (error) {
    return <h2 style={{ padding: 20 }}>❌ {error}</h2>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>📋 Panel de Recargas (ADMIN)</h1>

      <table border="1" cellPadding="10" style={{ width: "100%", marginTop: 20 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Red</th>
            <th>Dirección</th>
            <th>Monto</th>
            <th>6 Dígitos</th>
            <th>Captura</th>
            <th>Status</th>
            <th>Acciones</th>
            <th>Fecha</th>
          </tr>
        </thead>

        <tbody>
          {recargas.length === 0 && (
            <tr>
              <td colSpan="9" align="center">
                No hay recargas registradas
              </td>
            </tr>
          )}

          {recargas.map((r) => (
            <tr key={r.id}>
              <td>{r.user_id}</td>
              <td>{r.network}</td>
              <td>{r.address}</td>
              <td>S/ {r.amount}</td>
              <td>{r.operation_digits}</td>

              {/* IMAGEN */}
              <td>
                {r.image_url ? (
                  <a href={`${import.meta.env.VITE_API_URL.replace("/api", "")}/uploads/${r.image_url}`} 
                  target="_blank" 
                  rel="noreferrer">
                    Ver imagen
                  </a>
                ) : (
                  "Sin imagen"
                )}
              </td>

              {/* STATUS */}
              <td>
                <strong>{r.status}</strong>
              </td>

              {/* BOTONES */}
              <td>
                {r.status === "pendiente" && (
                  <>
                    <button
                      onClick={() => cambiarStatus(r.id, "aprobado")}
                      style={{ marginRight: 5 }}
                    >
                      ✅ Aprobar
                    </button>

                    <button
                      onClick={() => cambiarStatus(r.id, "rechazado")}
                    >
                      ❌ Rechazar
                    </button>
                  </>
                )}

                {r.status !== "pendiente" && "—"}
              </td>

              <td>{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
