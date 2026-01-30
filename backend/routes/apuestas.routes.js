const express = require('express');
const router = express.Router();
const { randomUUID } = require('node:crypto');

// Simulación de la base de datos (para este ejemplo, lo guardamos en memoria)
let apuestas = []; // Apuestas activas
let apuestaAbierta = false; // Estado general de las apuestas
let apuestaActual = null; // Información de la apuesta en curso

// Ruta para crear una nueva apuesta
router.post('/crear', (req, res) => {
  const { titulo, comentarios, probabilidad } = req.body;

  // Verificar si ya existe una apuesta activa
  if (apuestaActual && apuestaActual.estado !== 'cerrada') {
    return res.status(400).json({ msg: 'Ya hay una apuesta activa.' });
  }

  // Crear la nueva apuesta
  const nuevaApuesta = {
    id: randomUUID(),
    titulo,
    comentarios,
    estado: 'abierta',
    tipo: { 'Equipo A': 0, 'Equipo B': 0 },
    apuestas: [],
    probabilidad,
    createdAt: new Date().toISOString(),
  };

  apuestaActual = nuevaApuesta;
  apuestas.push(nuevaApuesta);
  res.json({ msg: 'Apuesta creada exitosamente', apuesta: nuevaApuesta });
});

// Ruta para obtener todas las apuestas activas
router.get('/activas', (req, res) => {
  res.json({ apuestas });
});

// Ruta para realizar una apuesta
router.post('/apostar', (req, res) => {
  const { apuestaId, monto, equipo, userId } = req.body;

  // Verificar que las apuestas estén abiertas
  if (!apuestaAbierta) {
    return res.status(400).json({ msg: 'Las apuestas están pausadas o cerradas.' });
  }

  // Buscar la apuesta
  const apuesta = apuestas.find(a => a.id === apuestaId);
  if (!apuesta) {
    return res.status(404).json({ msg: 'Apuesta no encontrada.' });
  }

  // Verificar que el monto apostado no exceda el balance necesario
  if (apuesta.tipo[equipo] === monto) {
    return res.status(400).json({ msg: 'Ya se cubrió el monto de este equipo.' });
  }

  // Agregar la apuesta del usuario
  apuesta.apuestas.push({ userId, monto, equipo });
  apuesta.tipo[equipo] += monto;

  res.json({ msg: 'Apuesta realizada con éxito', apuesta });
});

// Ruta para pausar las apuestas
router.post('/pausar', (req, res) => {
  apuestaAbierta = false;
  res.json({ msg: 'Apuestas pausadas' });
});

// Ruta para continuar las apuestas
router.post('/continuar', (req, res) => {
  apuestaAbierta = true;
  res.json({ msg: 'Apuestas reactivadas' });
});

// Ruta para cerrar todas las apuestas
router.post('/cerrar', (req, res) => {
  if (!apuestaActual) {
    return res.status(400).json({ msg: 'No hay apuestas activas para cerrar.' });
  }

  if (apuestaActual.estado === 'cerrada') {
    return res.status(400).json({ msg: 'La apuesta ya está cerrada.' });
  }

  // Cerrar la apuesta
  apuestaActual.estado = 'cerrada';
  res.json({ msg: 'Apuesta cerrada exitosamente', apuesta: apuestaActual });
});

// Ruta para marcar un ganador y calcular las ganancias
router.post('/marcar-ganador', (req, res) => {
  const { apuestaId, equipoGanador } = req.body;

  // Buscar la apuesta
  const apuesta = apuestas.find(a => a.id === apuestaId);
  if (!apuesta) {
    return res.status(404).json({ msg: 'Apuesta no encontrada.' });
  }

  // Marcar al ganador
  apuesta.ganador = equipoGanador;

  // Calcular las ganancias para los jugadores
  apuesta.apuestas.forEach(apuestaUser => {
    let ganancia = 0;
    if (apuestaUser.equipo === equipoGanador) {
      ganancia = apuestaUser.monto * apuesta.probabilidad;
      console.log(`Usuario ${apuestaUser.userId} ganó ${ganancia} soles`);
    }
  });

  res.json({ msg: 'Ganador marcado, ganancias calculadas', apuesta });
});

// Ruta para revertir acciones en caso de error
router.post('/revertir', (req, res) => {
  const { apuestaId } = req.body;

  // Buscar la apuesta
  const apuesta = apuestas.find(a => a.id === apuestaId);
  if (!apuesta) {
    return res.status(404).json({ msg: 'Apuesta no encontrada.' });
  }

  // Revertir las ganancias
  apuesta.apuestas.forEach(apuestaUser => {
    console.log(`Revirtiendo ganancias para el usuario ${apuestaUser.userId}`);
  });

  res.json({ msg: 'Acciones revertidas con éxito', apuesta });
});

// Ruta para cancelar una apuesta específica
router.post('/cancelar-apuesta', (req, res) => {
  const { apuestaId, userId } = req.body;

  const apuesta = apuestas.find(a => a.id === apuestaId);
  if (!apuesta) {
    return res.status(404).json({ msg: 'Apuesta no encontrada.' });
  }

  // Cancelar la apuesta de un usuario específico y devolver el dinero
  const index = apuesta.apuestas.findIndex(a => a.userId === userId);
  if (index === -1) {
    return res.status(400).json({ msg: 'Usuario no encontrado en esta apuesta.' });
  }

  // Retornar el dinero al usuario (en este ejemplo, solo eliminamos la apuesta)
  apuesta.apuestas.splice(index, 1);
  apuesta.tipo[apuesta.apuestas[index].equipo] -= apuesta.apuestas[index].monto;

  res.json({ msg: 'Apuesta cancelada y dinero devuelto', apuesta });
});

module.exports = router;
