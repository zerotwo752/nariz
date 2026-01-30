import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

export default function Retiros() {
  const [balance, setBalance] = useState(0);
  const [network, setNetwork] = useState("trc20");
  const [amount, setAmount] = useState("");
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const token = localStorage.getItem("token");

  // obtener perfil
  async function loadProfile() {
    try {
      const res = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        setBalance(res.data.user.balance);
      }
    } catch {
      setMsg("❌ Error cargando saldo");
    }
  }

  // obtener retiros
  async function loadWithdrawals() {
    try {
      const res = await axios.get(`${API}/withdrawals/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setWithdrawals(res.data.withdrawals || []);
    } catch {
      setMsg("❌ Error cargando historial");
    }
  }

  useEffect(() => {
    loadProfile();
    loadWithdrawals();
  }, []);

  async function handleWithdraw(e) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    try {
      const res = await axios.post(
        `${API}/withdrawals`,
        {
          amount,
          network,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.data.success) {
        setMsg("✅ Retiro solicitado correctamente");
        setAmount("");
        loadProfile();
        loadWithdrawals();
      } else {
        setMsg(res.data.error || "❌ No se pudo realizar el retiro");
      }
    } catch (err) {
      console.error(err);
      setMsg("❌ Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-6">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8">
        <h1 className="text-4xl font-extrabold text-center mb-2">💸 Retiros</h1>
        <p className="text-center text-gray-300">Solicita tu retiro de fondos</p>
      </div>

      {/* SALDO DISPONIBLE */}
      <div className="bg-gray-800 rounded-2xl p-6 shadow-xl mb-8">
        <h2 className="text-2xl font-semibold mb-3">Saldo disponible</h2>
        <p className="text-lg">{balance} USDT</p>
      </div>

      {/* MENSAJES DE ESTADO */}
      {msg && (
        <div
          className={`p-4 mb-6 text-white font-semibold rounded-lg ${
            msg.startsWith("❌") ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {msg}
        </div>
      )}

      {/* FORMULARIO DE RETIRO */}
      <form onSubmit={handleWithdraw} className="bg-gray-800 rounded-2xl p-6 shadow-xl mb-8">
        <div className="mb-4">
          <label htmlFor="network" className="block text-gray-300 font-medium mb-2">
            Red
          </label>
          <select
            id="network"
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="trc20">TRC20</option>
            <option value="bep20">BEP20</option>
            <option value="yape">Yape</option> {/* Opción Yape */}
            <option value="plin">Plin</option> {/* Opción Plin */}
          </select>
        </div>

        <div className="mb-6">
          <label htmlFor="amount" className="block text-gray-300 font-medium mb-2">
            Monto USDT
          </label>
          <input
            id="amount"
            type="number"
            value={amount}
            min="1"
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 rounded-xl text-white font-semibold hover:bg-indigo-500 transition ease-in-out duration-200"
        >
          {loading ? "Procesando..." : "Solicitar retiro"}
        </button>
      </form>

      {/* HISTORIAL DE RETIROS */}
      <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-2xl font-semibold mb-4">📜 Historial de Retiros</h3>

        {withdrawals.length === 0 ? (
          <p className="text-gray-400">No tienes retiros aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-gray-300">
              <thead>
                <tr>
                  <th className="py-2 px-4 text-left">ID</th>
                  <th className="py-2 px-4 text-left">Monto</th>
                  <th className="py-2 px-4 text-left">Red</th>
                  <th className="py-2 px-4 text-left">Dirección</th>
                  <th className="py-2 px-4 text-left">Estado</th>
                  <th className="py-2 px-4 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-t border-gray-700">
                    <td className="py-2 px-4">{w.id}</td>
                    <td className="py-2 px-4">{w.amount} USDT</td>
                    <td className="py-2 px-4">{w.network}</td>
                    <td className="py-2 px-4">{w.address}</td>
                    <td className="py-2 px-4">{w.status}</td>
                    <td className="py-2 px-4">{new Date(w.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
