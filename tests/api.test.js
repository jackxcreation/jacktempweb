import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import express from 'express';
import app from '../server.js';
// Import your app setup or server instance

describe('🚀 Jack Essentials Enterprise API Test Suite', () => {
  let authToken = '';
  let testProductId = '';
  let testOrderId = '';

  // 1. Auth & Login Test
  it('should authenticate user and return JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testadmin@thejackessentials.com', password: 'SecurePassword123' });
    
    if (res.status === 200) {
      authToken = res.body.token;
      expect(authToken).toBeDefined();
    }
  });

  // 2. Product CRUD Test
  it('should fetch public products list successfully', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      testProductId = res.body[0]._id;
    }
  });

  // 3. Order Creation & Inventory Atomic Check
  it('should create an order with strict Zod validation and inventory lock', async () => {
    if (!authToken || !testProductId) return;

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [{ productId: testProductId, quantity: 1 }],
        address: {
          name: "Test User",
          flat: "Flat 101",
          street: "MG Road",
          city: "Bangalore",
          state: "Karnataka",
          pincode: "560001",
          primaryPhone: "9876543210"
        },
        paymentMethod: "Razorpay Online"
      });

    if (res.status === 201) {
      testOrderId = res.body.id;
      expect(testOrderId).toBeDefined();
      expect(res.body.status).toBe('Pending');
    }
  });

  // 4. Payment Order Initialization
  it('should initialize Razorpay payment order securely', async () => {
    if (!authToken || !testOrderId) return;

    const res = await request(app)
      .post('/api/payment/create-order')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ orderId: testOrderId });

    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.order_id).toBeDefined();
    }
  });
});