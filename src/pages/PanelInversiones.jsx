import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;


export default function PanelInversiones() {
  const token = localStorage.getItem("token");

  /* ================= CONFIG INVERSIÓN ================= */
  const [dailyPercent, setDailyPercent] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [configMsg, setConfigMsg] = useState("");

  /* ================= BUSCAR USUARIO ================= */
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);
  const [searchMsg, setSearchMsg] = useState("");

  /* ================= BALANCE ================= */
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [balanceMsg, setBalanceMsg] = useState("");

  /* ================= INVERSIONES ================= */
  const [investments, setInvestments] = useState([]);

  /* ================= SANCIÓN ================= */
  const [refundAmount, setRefundAmount] = useState("");
  const [freezeDays, setFreezeDays] = useState("");
  const [sanctionReason, setSanctionReason] = useState("");
  const [sanctionMsg, setSanctionMsg] = useState("");

  /* ================= CONFIG INVERSIÓN ================= */
  const updateInvestmentSettings = async () => {
    setConfigMsg("");
    try {
      const res = await fetch(`${API}/admin/investment/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          daily_percent: dailyPercent,
          duration_days: durationDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      setConfigMsg("✅ Configuración actualizada");
      setDailyPercent("");
      setDurationDays("");
    } catch {
      setConfigMsg("❌ Error actualizando configuración");
    }
  };

  /* ================= BUSCAR USUARIO ================= */
  const searchUser = async () => {
    setSearchMsg("");
    setUser(null);
    setInvestments([]);

    try {
      const res = await fetch(
        `${API}/admin/users/search?q=${query}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await res.json();
      if (!res.ok) throw new Error();

      setUser(data);
      loadUserInvestments(data.id);
    } catch {
      setSearchMsg("❌ Usuario no encontrado");
    }
  };

  /* ================= CARGAR INVERSIONES ================= */
  const loadUserInvestments = async (userId) => {
    const res = await fetch(`${API}/admin/investments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setInvestments(data.filter((i) => i.user_id === userId));
  };

  /* ================= BALANCE ================= */
  const updateBalance = async () => {
    setBalanceMsg("");
    try {
      const res = await fetch(
        `${API}/admin/users/${user.id}/balance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount, reason }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error();

      setBalanceMsg(`✅ Nuevo balance: ${data.newBalance}`);
      setAmount("");
      setReason("");
    } catch {
      setBalanceMsg("❌ Error modificando balance");
    }
  };

  /* ================= SANCIONES ================= */
  const cancelInvestment = async (id) => {
    await fetch(`${API}/admin/investments/${id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        refundAmount,
        reason: sanctionReason,
      }),
    });
    setSanctionMsg("✅ Inversión cancelada");
    loadUserInvestments(user.id);
  };

  const freezeInvestment = async (id) => {
    await fetch(`${API}/admin/investments/${id}/freeze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        days: freezeDays,
        reason: sanctionReason,
      }),
    });
    setSanctionMsg("⏸ Inversión congelada");
    loadUserInvestments(user.id);
  };

  const banInvestment = async (id) => {
    await fetch(`${API}/admin/investments/${id}/ban`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: sanctionReason }),
    });
    setSanctionMsg("⛔ Inversión baneada");
    loadUserInvestments(user.id);
  };

  return (
    <div style={{ padding: 30, maxWidth: 1000 }}>
      <h1>🛠 Panel Admin - Inversiones</h1>

      {/* CONFIG */}
      <h2>⚙️ Configuración</h2>
      <input placeholder="% diario" value={dailyPercent} onChange={(e) => setDailyPercent(e.target.value)} />
      <input placeholder="Días" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
      <button onClick={updateInvestmentSettings}>Guardar</button>
      <p>{configMsg}</p>

      {/* BUSCAR */}
      <h2>🔍 Buscar Usuario</h2>
      <input placeholder="ID o username" value={query} onChange={(e) => setQuery(e.target.value)} />
      <button onClick={searchUser}>Buscar</button>
      <p>{searchMsg}</p>

      {user && (
        <>
          <h3>👤 Usuario</h3>
          <p>ID: {user.id}</p>
          <p>{user.username} — {user.email}</p>
          <p>Balance: ${user.balance}</p>

          <h3>💰 Modificar Balance</h3>
          <input placeholder="+10 o -10" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button onClick={updateBalance}>Aplicar</button>
          <p>{balanceMsg}</p>

          <h3>🚫 Inversiones</h3>

          {investments.map((inv) => (
            <div key={inv.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
              <p>ID: {inv.id} | Monto: ${inv.amount} | Estado: {inv.status}</p>

              <input placeholder="Devolución $" onChange={(e) => setRefundAmount(e.target.value)} />
              <input placeholder="Congelar días" onChange={(e) => setFreezeDays(e.target.value)} />
              <input placeholder="Motivo" onChange={(e) => setSanctionReason(e.target.value)} />

              <div>
                <button onClick={() => cancelInvestment(inv.id)}>Cancelar</button>
                <button onClick={() => freezeInvestment(inv.id)}>Congelar</button>
                <button onClick={() => banInvestment(inv.id)}>Ban</button>
              </div>
            </div>
          ))}

          <p>{sanctionMsg}</p>
        </>
      )}
    </div>
  );
}
