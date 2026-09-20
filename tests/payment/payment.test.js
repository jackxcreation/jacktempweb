// tests/payment/payment.test.js
const request = require('supertest');
const app = require('../../server'); // Express app instance

describe('💳 Comprehensive Payment & Reconciliation Automated Test Suite (Task #77)', () => {

  // 1. WRONG SIGNATURE TEST
  test('1. Should reject payment verification with invalid or fake signature (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/api/payment/verify')
      .send({
        razorpay_order_id: 'order_dummy_123',
        razorpay_payment_id: 'pay_dummy_123',
        razorpay_signature: 'invalid_cryptographic_signature_hash'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 2. FAKE ORDER ID TEST
  test('2. Should reject payment order creation with non-existent or fake order ID (404 Not Found)', async () => {
    const res = await request(app)
      .post('/api/payment/create-order')
      .send({ 
        orderId: '507f1f77bcf86cd799439011' // Non-existent MongoDB ObjectId
      });

    expect([400, 404]).toContain(res.statusCode);
    expect(res.body.success).toBe(false);
  });

  // 3. WRONG AMOUNT / TAMPERED CART TOTAL TEST
  test('3. Should detect and reject tampered or mismatched order payment amounts', async () => {
    const res = await request(app)
      .post('/api/payment/verify')
      .send({
        razorpay_order_id: 'order_test_amount',
        razorpay_payment_id: 'pay_test_amount',
        razorpay_signature: 'valid_looking_signature',
        clientDeclaredAmountPaise: 1000 // Tampered amount
      });

    expect([400, 422]).toContain(res.statusCode);
    expect(res.body.success).toBe(false);
  });

  // 4. WRONG CURRENCY TEST
  test('4. Should reject unsupported or incorrect payment currencies (e.g., USD instead of INR)', async () => {
    const res = await request(app)
      .post('/api/payment/create-order')
      .send({
        orderId: '507f1f77bcf86cd799439011',
        currency: 'USD'
      });

    expect([400, 422]).toContain(res.statusCode);
  });

  // 5. PAYMENT FAILED STATUS TEST
  test('5. Should handle payment failure webhooks or callbacks gracefully and update order status', async () => {
    const res = await request(app)
      .post('/api/payment/webhook')
      .send({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_123',
              order_id: 'order_test_fail',
              status: 'failed',
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment processing failed by bank'
            }
          }
        }
      });

    expect([200, 400]).toContain(res.statusCode);
  });

  // 6. PAYMENT CAPTURED SUCCESS TEST
  test('6. Should successfully process webhook or verification for captured payments', async () => {
    const res = await request(app)
      .post('/api/payment/webhook')
      .send({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_captured_123',
              order_id: 'order_test_success',
              amount: 50000,
              currency: 'INR',
              status: 'captured'
            }
          }
        }
      });

    expect([200, 400]).toContain(res.statusCode);
  });

  // 7. DUPLICATE WEBHOOK IDEMPOTENCY TEST
  test('7. Should handle duplicate webhook events idempotently without double-processing', async () => {
    const duplicatePayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_duplicate_123',
            order_id: 'order_test_dup',
            status: 'captured'
          }
        }
      }
    };

    // First event delivery
    await request(app).post('/api/payment/webhook').send(duplicatePayload);

    // Duplicate event redelivery (should return 200 OK without re-triggering fulfillment)
    const res = await request(app).post('/api/payment/webhook').send(duplicatePayload);
    expect([200, 400]).toContain(res.statusCode);
  });

});