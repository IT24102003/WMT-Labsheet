const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const router = express.Router();

router.get('/total-spent/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const result = await Order.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(studentId) } },
      { $group: { _id: '$student', totalSpent: { $sum: '$totalPrice' } } }
    ]);

    const totalSpent = result.length > 0 ? result[0].totalSpent : 0;
    res.json({ studentId, totalSpent });
  } catch (err) {
    console.error('Error calculating total spent:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/top-menu-items', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const result = await Order.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.menuItem', totalQuantity: { $sum: '$items.quantity' } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit }
    ]);

    await Order.populate(result, { path: '_id', model: 'MenuItem' });

    const formatted = result.map(item => ({
      menuItem: item._id,
      totalQuantity: item.totalQuantity
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching top menu items:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/daily-orders', async (req, res) => {
  try {
    const result = await Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const formatted = result.map(item => ({
      date: item._id,
      orderCount: item.orderCount
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching daily orders:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
