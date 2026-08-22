const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse'); 

router.get('/api/warehouse', async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ createdAt: -1 });
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch warehouse" });
  }
});

router.post('/api/warehouse', async (req, res) => {
  try {
    const newWarehouse = new Warehouse(req.body);
    const savedWarehouse = await newWarehouse.save();
    res.status(201).json(savedWarehouse);
  } catch (error) {
    res.status(500).json({ error: "Failed to create warehouse" });
  }
});

module.exports = router;