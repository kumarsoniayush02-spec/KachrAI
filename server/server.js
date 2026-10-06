const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ──── Database layer with in-memory fallback ────
// When MongoDB is available, use it. Otherwise, fall back to an
// in-memory store so the app works even without a database (e.g. on
// Render free tier without MongoDB Atlas configured).

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kachrai';
let dbConnected = false;

// In-memory store (used when MongoDB is unavailable)
let memoryStore = [];
let memoryIdCounter = 1;

mongoose.connect(MONGO_URI)
  .then(() => { dbConnected = true; console.log('MongoDB Connected Successfully'); })
  .catch((err) => { console.error('MongoDB Connection Error:', err.message); console.log('⚡ Running with in-memory store (data will not persist across restarts)'); });

// Listen for disconnect events
mongoose.connection.on('disconnected', () => { dbConnected = false; });
mongoose.connection.on('connected', () => { dbConnected = true; });

// Report Schema (used when MongoDB is connected)
const reportSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  severityScore: { type: Number, required: true }, // 1 to 5
  blockageType: { type: String, required: true },
  status: { type: String, default: 'Pending' }, // Pending, Dispatched, Resolved
  createdAt: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', reportSchema);

// ──── Severity & blockage helpers ────
function generateSeverityScore() {
  const rand = Math.random();
  if (rand < 0.15)      return 1;  // 15% chance — Minor
  else if (rand < 0.35) return 2;  // 20% chance — Low
  else if (rand < 0.60) return 3;  // 25% chance — Moderate
  else if (rand < 0.82) return 4;  // 22% chance — High
  else                  return 5;  // 18% chance — Critical
}

const blockageTypes = [
  "Plastic waste and organic silt accumulation",
  "Construction debris blocking drain inlet",
  "Leaf litter and natural organic blockage",
  "Mixed waste — bottles, wrappers, and silt",
  "Heavy sludge and solid waste compaction",
  "Minor sediment buildup near grate",
  "Textile and fabric clogging drain mesh",
];

function generateBlockageType() {
  return blockageTypes[Math.floor(Math.random() * blockageTypes.length)];
}

// Test Route
app.get('/', (req, res) => {
  res.send(`KachrAI Backend is running! (DB: ${dbConnected ? 'MongoDB' : 'in-memory'})`);
});

// GET all reports
app.get('/api/reports', async (req, res) => {
  try {
    if (dbConnected) {
      const reports = await Report.find().sort({ createdAt: -1 });
      return res.json(reports);
    }
    // In-memory fallback — return sorted copy
    const sorted = [...memoryStore].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sorted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST a new report
app.post('/api/reports', async (req, res) => {
  try {
    const { imageUrl, latitude, longitude } = req.body;
    const severityScore = generateSeverityScore();
    const blockageType = generateBlockageType();

    if (dbConnected) {
      const newReport = new Report({
        imageUrl, latitude, longitude,
        severityScore, blockageType,
        status: 'Pending'
      });
      await newReport.save();
      return res.status(201).json({ message: 'Report submitted successfully!', report: newReport });
    }

    // In-memory fallback
    const newReport = {
      _id: String(memoryIdCounter++),
      imageUrl, latitude, longitude,
      severityScore, blockageType,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    memoryStore.push(newReport);
    res.status(201).json({ message: 'Report submitted successfully!', report: newReport });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while saving report' });
  }
});

// PATCH report status (cycle: Pending → Dispatched → Resolved)
const STATUS_CYCLE = { Pending: 'Dispatched', Dispatched: 'Resolved', Resolved: 'Pending' };

app.patch('/api/reports/:id/status', async (req, res) => {
  try {
    // Allow explicit status in body, or auto-cycle
    const nextStatus = req.body.status;

    if (dbConnected) {
      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ error: 'Report not found' });
      report.status = nextStatus || STATUS_CYCLE[report.status] || 'Pending';
      await report.save();
      return res.json({ message: 'Status updated', report });
    }

    // In-memory fallback
    const report = memoryStore.find(r => r._id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.status = nextStatus || STATUS_CYCLE[report.status] || 'Pending';
    res.json({ message: 'Status updated', report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE a single report
app.delete('/api/reports/:id', async (req, res) => {
  try {
    if (dbConnected) {
      const report = await Report.findByIdAndDelete(req.params.id);
      if (!report) return res.status(404).json({ error: 'Report not found' });
      return res.json({ message: 'Report deleted successfully' });
    }

    // In-memory fallback
    const idx = memoryStore.findIndex(r => r._id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Report not found' });
    memoryStore.splice(idx, 1);
    res.json({ message: 'Report deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});