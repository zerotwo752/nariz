import { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "../utils/auth";

const API = import.meta.env.VITE_API_URL;

export default function PanelRetiros() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  const token = getToken();

  const loadWithdrawals = async () => {
    try {
      const res = await axios.get(`${API}/admin/withdrawals`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setWithdrawals(res.data);
    } catch (err) {
      console.error(err);
      alert("Error cargando retiros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  // ✅ APROBAR retiro
  const approveWithdrawal = async (withdrawalId) => {
    if (!confirm("¿Confirmar retiro?")) return;

    try {
      await axios.put(
        `${API}/admin/withdrawals/${withdrawalId}`,
        { status: "aprobado" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Retiro aprobado");
      loadWithdrawals();
    } catch (err) {
      console.error(err);
      alert("Error al aprobar retiro");
    }
  };

  // ✅ RECHAZAR retiro
  const rejectWithdrawal = async (withdrawalId) => {
    const reason = prompt("Motivo del rechazo:");

    if (!reason) return;

    try {
      await axios.put(
        `${API}/admin/withdrawals/${withdrawalId}`,
        { status: "rechazado", reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert("Retiro rechazado y saldo devuelto");
      loadWithdrawals();
    } catch (err) {
      console.error(err);
      alert("Error al rechazar retiro");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">💰 Panel de Retiros</h1>

      {loading && <p>Cargando...</p>}

      {!loading && withdrawals.length === 0 && (
        <p>No hay retiros registrados.</p>
      )}

      {!loading && withdrawals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full bg-gray-800 rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-gray-700">
                <th className="p-2">ID</th>
                <th className="p-2">Usuario</th>
                <th className="p-2">Email</th>
                <th className="p-2">Saldo actual</th>
                <th className="p-2">Red</th>
                <th className="p-2">Dirección</th>
                <th className="p-2">Monto</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-b border-gray-700">
                  <td className="p-2 text-center">{w.user?.id}</td>

                  <td className="p-2 text-center">{w.user?.username}</td>

                  <td className="p-2 text-center">{w.user?.email}</td>

                  <td className="p-2 text-center">{w.user?.balance}</td>

                  <td className="p-2 text-center">
                    {w.network?.toUpperCase()}
                  </td>

                  <td className="p-2 text-xs break-all">{w.address}</td>

                  <td className="p-2 text-center">${w.amount}</td>

                  {/* 🔥 ESTADOS EN ESPAÑOL */}
                  <td className="p-2 text-center">
                    {w.status === "pendiente" && (
                      <span className="text-yellow-400 font-bold">
                        Pendiente
                      </span>
                    )}
                    {w.status === "aprobado" && (
                      <span className="text-green-400 font-bold">
                        Aprobado
                      </span>
                    )}
                    {w.status === "rechazado" && (
                      <span className="text-red-400 font-bold">
                        Rechazado
                      </span>
                    )}
                  </td>

                  {/* 🔥 BOTONES FUNCIONALES */}
                  <td className="p-2 text-center">
                    {w.status === "pendiente" && (
                      <div className="space-x-2">
                        <button
                          onClick={() => approveWithdrawal(w.id)}
                          className="px-3 py-1 bg-green-600 rounded-xl hover:bg-green-500"
                        >
                          Aprobar
                        </button>

                        <button
                          onClick={() => rejectWithdrawal(w.id)}
                          className="px-3 py-1 bg-red-600 rounded-xl hover:bg-red-500"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}

                    {w.status === "aprobado" && (
                      <span className="text-green-400 font-semibold">
                        ✔️ Aceptado
                      </span>
                    )}

                    {w.status === "rechazado" && (
                      <span className="text-red-400 font-semibold">
                        ❌ Rechazado
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
