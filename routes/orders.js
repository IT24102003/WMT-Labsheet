const express = require('express');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const router = express.Router();

async function calculateTotalPrice(items) {
  const itemIds = items.map(item => item.menuItem);
  const menuItems = await MenuItem.find({ _id: { $in: itemIds } });
  const priceMap = {};
  menuItems.forEach(item => {
    priceMap[item._id.toString()] = item.price;
  });

  let total = 0;
  for (const item of items) {
    const price = priceMap[item.menuItem.toString()];
    if (price === undefined) {
      throw new Error(`Invalid menu item ID: ${item.menuItem}`);
    }
    total += price * item.quantity;
  }
  return total;
}

router.post('/', async (req, res) => {
  try {
    const { student, items } = req.body;
    if (!student) return res.status(400).json({ error: 'student must exist' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'items must be a non-empty array' });

    const totalPrice = await calculateTotalPrice(items);
    
    const order = new Order({ student, items, totalPrice, status: 'PLACED' });
    const savedOrder = await order.save();
    
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('student')
      .populate('items.menuItem');
      
    res.status(201).json(populatedOrder);
  } catch (err) {
    console.error('Error creating order:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('student')
      .populate('items.menuItem');

    const total = await Order.countDocuments();

    res.json({
      metadata: { total, page, limit, totalPages: Math.ceil(total / limit) },
      orders
    });
  } catch (err) {
    console.error('Error fetching orders:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('student')
      .populate('items.menuItem');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error('Error fetching order by ID:', err.message);
    res.status(400).json({ error: 'Invalid order ID' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['PLACED', 'PREPARING', 'DELIVERED', 'CANCELLED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).populate('student').populate('items.menuItem');

    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error('Error updating status:', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Error deleting order:', err.message);
    res.status(400).json({ error: 'Invalid order ID' });
  }
});

module.exports = router;
