import React, { useEffect, useState } from "react";
import axios from "axios";
const API = import.meta.env.VITE_API_URL;




export default function PanelApuestas() {
  const [cases, setCases] = useState([]);

  // Crear caja
  const [newCase, setNewCase] = useState({
    name: "",
    price: "",
    image: null,
  });

  // Crear item normal
  const [itemData, setItemData] = useState({
    case_id: "",
    name: "",
    price: "",
    drop_chance: "",
    image: null,
  });

  // Crear especial
  const [specialData, setSpecialData] = useState({
    case_id: "",
    name: "",
    max_drops: "",
    special_chance: "",
    image: null,
  });

  // Asignar valores a especial
  const [assignData, setAssignData] = useState({
    id: "",
    total_value: "",
    duration_days: "",
  });

  
  // Entregar especial manualmente
  const [giveSpecial, setGiveSpecial] = useState({
    user_id: "",
    special_id: ""
  });



  // =====================
  // CARGAR CAJAS ACTIVAS
  // =====================
  const loadCases = async () => {
    try {
      const res = await axios.get(`${API}/cases`);
      setCases(res.data);
    } catch (err) {
      console.error(err);
      alert("Error cargando cajas");
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

    // =======================
    // GESTIONAR APUESTAS
    // =======================
    const [apuestas, setApuestas] = useState([]); // Para manejar las apuestas activas
    const [apuestaAbierta, setApuestaAbierta] = useState(false); // Estado de las apuestas
  
    // Crear nueva apuesta
    const [newApuesta, setNewApuesta] = useState({
      titulo: "",
      comentarios: "",
      probabilidad: "1.8",
    });
  
    // =======================
    // CARGAR APUESTAS ACTIVAS
    // =======================
    const loadApuestas = async () => {
      try {
        const res = await axios.get(`${API}/apuestas/activas`);
        setApuestas(res.data.apuestas);
      } catch (err) {
        console.error(err);
        alert("Error cargando apuestas");
      }
    };

   



  
    useEffect(() => {
      loadApuestas(); // Cargar apuestas activas al inicio
    }, []);
// =====================
    // CREAR APUESTA
    // =====================
    const handleCreateApuesta = async (e) => {
      e.preventDefault();
      try {
        const { titulo, comentarios, probabilidad } = newApuesta;
        const res = await axios.post(`${API}/apuestas/crear`, {
          titulo,
          comentarios,
          probabilidad,
        });
        alert("Apuesta creada");
        loadApuestas(); // Recargar las apuestas después de crear una nueva
      } catch (err) {
        console.error(err);
        alert("Error creando apuesta");
      }
    };
    
    // =====================
    // PAUSAR APOSTAR
    // =====================
    const handlePausarApuestas = async () => {
      try {
        await axios.post(`${API}/apuestas/pausar`);
        setApuestaAbierta(false); // Cambiar el estado en el front
        alert("Apuestas pausadas");
      } catch (err) {
        console.error(err);
        alert("Error pausando apuestas");
      }
    };
    
    // =====================
    // CONTINUAR APOSTAR
    // =====================
    const handleContinuarApuestas = async () => {
      try {
        await axios.post(`${API}/apuestas/continuar`);
        setApuestaAbierta(true); // Cambiar el estado en el front
        alert("Apuestas reactivadas");
      } catch (err) {
        console.error(err);
        alert("Error reactivando apuestas");
      }
    };
    
    // =====================
    // CERRAR APOSTAR
    // =====================
    const handleCerrarApuestas = async () => {
      try {
        await axios.post(`${API}/apuestas/cerrar`);
        setApuestaAbierta(false); // Cambiar el estado en el front
        alert("Apuestas cerradas");
      } catch (err) {
        console.error(err);
        alert("Error cerrando apuestas");
      }
    };

  


  

  

  // =====================
  // CREAR CAJA
  // =====================
  const handleCreateCase = async (e) => {
    e.preventDefault();

    try {
      const formData = new FormData();
      formData.append("name", newCase.name);
      formData.append("price", newCase.price);
      if (newCase.image) formData.append("image", newCase.image);

      await axios.post(`${API}/cases`, formData);
      alert("Caja creada");
      loadCases();
    } catch (err) {
      console.error(err);
      alert("Error creando caja");
    }
  };

  /* eliminar caja */

  const deleteCase = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta caja?")) return;

    try {
      await axios.delete(`${API}/cases/${id}`);
      alert("Caja eliminada");
      loadCases();
    } catch (err) {
      console.error(err);
      alert("Error eliminando caja");
    }
  };


  

  // =====================
  // CREAR ITEM NORMAL
  // =====================
  const handleCreateItem = async (e) => {
    e.preventDefault();

    if (itemData.drop_chance < 0 || itemData.drop_chance > 100) {
      alert("Probabilidad debe ser entre 0 y 100");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", itemData.name);
      formData.append("price", itemData.price);
      formData.append("drop_chance", itemData.drop_chance);
      if (itemData.image) formData.append("image", itemData.image);

      await axios.post(`${API}/cases/${itemData.case_id}/items`, formData);

      alert("Item creado");
    } catch (err) {
      console.error(err);
      alert("Error creando item");
    }
  };

  // =====================
  // CREAR ESPECIAL
  // =====================
  const handleCreateSpecial = async (e) => {
    e.preventDefault();

    if (specialData.special_chance < 0 || specialData.special_chance > 100) {
      alert("Probabilidad debe ser 0–100");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", specialData.name);
      formData.append("max_drops", specialData.max_drops);
      formData.append("special_chance", specialData.special_chance);
      if (specialData.image) formData.append("image", specialData.image);

      await axios.post(
        `${API}/cases/${specialData.case_id}/special`,
        formData
      );

      alert("Especial creado");
    } catch (err) {
      console.error(err);
      alert("Error creando especial");
    }
  };

  // =====================
  // ASIGNAR VALOR ESPECIAL
  // =====================
  const handleAssignSpecial = async (e) => {
    e.preventDefault();

    try {
      await axios.post(`${API}/special/${assignData.id}/set-value`, {
        total_value: assignData.total_value,
        duration_days: assignData.duration_days,
      });

      alert("Valor asignado");
    } catch (err) {
      console.error(err);
      alert("Error asignando valor");
    }
  };

    // =====================
  // ENTREGAR ESPECIAL MANUAL
  // =====================
  const handleGiveSpecial = async (e) => {
    e.preventDefault();

    try {
      await axios.post(`${API}/special/give`, {
        user_id: giveSpecial.user_id,
        special_id: giveSpecial.special_id
      });

      alert("Especial entregado correctamente");
    } catch (err) {
      console.error(err);

      if (err.response?.data?.error) {
        alert("Error: " + err.response.data.error);
      } else {
        alert("No se pudo entregar el especial");
      }
    }
  };

  

  // =====================
  // ESTILOS SIMPLES
  // =====================
  const box = {
    border: "1px solid #ccc",
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Panel de Apuestas</h1>

      {/* ============ PANEL APUESTAS ADMIN ============ */}

      <div style={box}>
        <h2>Crear Apuesta</h2>
      
        <form onSubmit={handleCreateApuesta}>
          <div>
            <label>Título:</label>
            <input
              type="text"
              value={newApuesta.titulo}
              onChange={(e) =>
                setNewApuesta({ ...newApuesta, titulo: e.target.value })
              }
            />
          </div>
      
          <div>
            <label>Comentarios:</label>
            <textarea
              value={newApuesta.comentarios}
              onChange={(e) =>
                setNewApuesta({ ...newApuesta, comentarios: e.target.value })
              }
            />
          </div>
      
          <div>
            <label>Probabilidad:</label>
            <input
              type="number"
              step="0.01"
              value={newApuesta.probabilidad}
              onChange={(e) =>
                setNewApuesta({ ...newApuesta, probabilidad: e.target.value })
              }
            />
          </div>
      
          <button type="submit">Crear apuesta</button>
        </form>
      </div>
      
      <div style={box}>
        <h2>Control de apuestas</h2>
      
        <button onClick={handlePausarApuestas}>Pausar</button>
        <button onClick={handleContinuarApuestas}>Continuar</button>
        <button onClick={handleCerrarApuestas}>Cerrar</button>
      </div>
      
      <div style={box}>
        <h2>Apuestas activas</h2>
      
        {apuestas.length === 0 ? (
          <p>No hay apuestas</p>
        ) : (
          apuestas.map((a) => (
            <div key={a.id} style={{ marginBottom: 10 }}>
              <strong>{a.titulo}</strong>
              <p>{a.comentarios}</p>
              <p>x{a.probabilidad}</p>
            </div>
          ))
        )}
      </div>


      

      {/* ================= CREAR CAJA ================= */}
      <div style={box}>
        <h2>Crear caja</h2>

        <form onSubmit={handleCreateCase}>
          <div>
            <label>Nombre:</label>
            <input
              type="text"
              value={newCase.name}
              onChange={(e) =>
                setNewCase({ ...newCase, name: e.target.value })
              }
            />
          </div>

          <div>
            <label>Precio:</label>
            <input
              type="number"
              step="0.01"
              value={newCase.price}
              onChange={(e) =>
                setNewCase({ ...newCase, price: e.target.value })
              }
            />
          </div>

          <div>
            <label>Imagen:</label>
            <input
              type="file"
              onChange={(e) =>
                setNewCase({ ...newCase, image: e.target.files[0] })
              }
            />
          </div>

          <button type="submit">Crear caja</button>
        </form>
      </div>

      {/* ================= LISTADO ================= */}
      <div style={box}>
        <h2>Cajas activas</h2>

        {cases.map((c) => (
          <div key={c.id} style={{ marginBottom: 5 }}>
            <strong>{c.name}</strong> — ${c.price}
            <button
              style={{ marginLeft: 10 }}
              onClick={() => deleteCase(c.id)}
            >
              Eliminar
            </button>
          </div>
        ))}

      </div>

      {/* ================= CREAR ITEM ================= */}
      <div style={box}>
        <h2>Agregar item a caja</h2>

        <form onSubmit={handleCreateItem}>
          <div>
            <label>Seleccionar caja:</label>
            <select
              value={itemData.case_id}
              onChange={(e) =>
                setItemData({ ...itemData, case_id: e.target.value })
              }
            >
              <option value="">Seleccione...</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Nombre del item:</label>
            <input
              type="text"
              onChange={(e) =>
                setItemData({ ...itemData, name: e.target.value })
              }
            />
          </div>

          <div>
            <label>Precio:</label>
            <input
              type="number"
              step="0.01"
              onChange={(e) =>
                setItemData({ ...itemData, price: e.target.value })
              }
            />
          </div>

          <div>
            <label>Probabilidad (0–100):</label>
            <input
              type="number"
              step="0.01"
              value={itemData.drop_chance}
              onChange={(e) =>
                setItemData({ ...itemData, drop_chance: e.target.value })
              }
            />
          </div>

          <div>
            <label>Imagen:</label>
            <input
              type="file"
              onChange={(e) =>
                setItemData({ ...itemData, image: e.target.files[0] })
              }
            />
          </div>

          <button type="submit">Crear item</button>
        </form>
      </div>

      {/* ================= CREAR ESPECIAL ================= */}
      <div style={box}>
        <h2>Crear especial</h2>

        <form onSubmit={handleCreateSpecial}>
          <div>
            <label>Seleccionar caja:</label>
            <select
              value={specialData.case_id}
              onChange={(e) =>
                setSpecialData({ ...specialData, case_id: e.target.value })
              }
            >
              <option value="">Seleccione...</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Nombre:</label>
            <input
              type="text"
              onChange={(e) =>
                setSpecialData({ ...specialData, name: e.target.value })
              }
            />
          </div>

          <div>
            <label>Max drops:</label>
            <input
              type="number"
              onChange={(e) =>
                setSpecialData({ ...specialData, max_drops: e.target.value })
              }
            />
          </div>

          <div>
            <label>Probabilidad (0–100):</label>
            <input
              type="number"
              step="0.01"
              onChange={(e) =>
                setSpecialData({
                  ...specialData,
                  special_chance: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label>Imagen:</label>
            <input
              type="file"
              onChange={(e) =>
                setSpecialData({ ...specialData, image: e.target.files[0] })
              }
            />
          </div>

          <button type="submit">Crear especial</button>
        </form>
      </div>

      {/* ================= ASIGNAR VALOR ================= */}
      <div style={box}>
        <h2>Asignar valor a especial</h2>

        <form onSubmit={handleAssignSpecial}>
          <div>
            <label>ID especial:</label>
            <input
              type="number"
              step="0.01"
              onChange={(e) =>
                setAssignData({ ...assignData, id: e.target.value })
              }
            />
          </div>

          <div>
            <label>Valor total:</label>
            <input
              type="number"
              onChange={(e) =>
                setAssignData({ ...assignData, total_value: e.target.value })
              }
            />
          </div>

          <div>
            <label>Días duración:</label>
            <input
              type="number"
              onChange={(e) =>
                setAssignData({
                  ...assignData,
                  duration_days: e.target.value,
                })
              }
            />
          </div>

          <button type="submit">Asignar</button>
        </form>
      </div>
            {/* ================= ENTREGAR ESPECIAL MANUAL ================= */}
      <div style={box}>
        <h2>Entregar especial manualmente</h2>

        <form onSubmit={handleGiveSpecial}>
          <div>
            <label>ID Usuario:</label>
            <input
              type="number"
              onChange={(e) =>
                setGiveSpecial({ ...giveSpecial, user_id: e.target.value })
              }
            />
          </div>

          <div>
            <label>ID Especial:</label>
            <input
              type="number"
              onChange={(e) =>
                setGiveSpecial({ ...giveSpecial, special_id: e.target.value })
              }
            />
          </div>

          <button type="submit">Entregar especial</button>
        </form>
      </div>

    </div>
  );
}
