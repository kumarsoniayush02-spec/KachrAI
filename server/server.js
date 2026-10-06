const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// MongoDB Connection (You can add your MongoDB URI to a .env file later)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kachrai';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Report Schema
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

// Test Route
app.get('/', (req, res) => {
  res.send('KachrAI Backend is running!');
});

// GET all reports (for the Municipal Dashboard map)
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST a new report (Citizen submission)
app.post('/api/reports', async (req, res) => {
  try {
    const { imageUrl, latitude, longitude } = req.body;

    // TODO: In production/hackathon final polish, you can pass 'imageUrl' 
    // to a Vision AI model here to get real-time severity scoring.
    // For now, we simulate with a weighted distribution across 1-5:
    const rand = Math.random();
    let severityScore;
    if (rand < 0.15)      severityScore = 1;  // 15% chance — Minor
    else if (rand < 0.35) severityScore = 2;  // 20% chance — Low
    else if (rand < 0.60) severityScore = 3;  // 25% chance — Moderate
    else if (rand < 0.82) severityScore = 4;  // 22% chance — High
    else                  severityScore = 5;  // 18% chance — Critical

    const blockageTypes = [
      "Plastic waste and organic silt accumulation",
      "Construction debris blocking drain inlet",
      "Leaf litter and natural organic blockage",
      "Mixed waste — bottles, wrappers, and silt",
      "Heavy sludge and solid waste compaction",
      "Minor sediment buildup near grate",
      "Textile and fabric clogging drain mesh",
    ];
    const blockageType = blockageTypes[Math.floor(Math.random() * blockageTypes.length)];

    const newReport = new Report({
      imageUrl,
      latitude,
      longitude,
      severityScore,
      blockageType,
      status: 'Pending'
    });

    await newReport.save();
    res.status(201).json({ message: 'Report submitted successfully!', report: newReport });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while saving report' });
  }
});

// DELETE a single report
app.delete('/api/reports/:id', async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
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