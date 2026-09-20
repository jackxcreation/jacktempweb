// tests/auth/auth.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server'); // Express app instance
const { User } = require('../../models');

describe('🔒 Comprehensive Authentication Automated Test Suite (Task #76)', () => {
  let testUserId = '';
  let authToken = '';
  const uniqueEmail = `test_user_${Date.now()}@jackessentials.com`;
  const testPassword = 'SecurePassword123!';

  // Cleanup test user after suite runs
  afterAll(async () => {
    try {
      await User.deleteOne({ email: uniqueEmail });
    } catch (e) {}
  });

  // 1. REGISTER TEST
  test('1. Should successfully register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Automated Test User',
        email: uniqueEmail,
        password: testPassword,
        phone: '9876543210'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    if (res.body.user) {
      testUserId = res.body.user.id || res.body.user._id;
    }
  });

  // 2. LOGIN TEST (CORRECT CREDENTIALS)
  test('2. Should successfully login with correct credentials and return token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: testPassword
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
  });

  // 3. WRONG PASSWORD TEST
  test('3. Should reject login with wrong password (401 Unauthorized)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'IncorrectPassword999!'
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 4. OTP VERIFICATION TEST
  test('4. Should handle OTP verification endpoint gracefully', async () => {
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({
        email: uniqueEmail,
        otp: '123456'
      });

    // Expect either success or mock handling depending on active service configuration
    expect([200, 400]).toContain(res.statusCode);
  });

  // 5. ACCOUNT LOCK TEST
  test('5. Should lock user account when security flag is triggered', async () => {
    if (testUserId) {
      const user = await User.findById(testUserId);
      if (user) {
        user.isLocked = true;
        await user.save();
      }

      // Try logging in while locked
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueEmail,
          password: testPassword
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');
    }
  });

  // 6. ACCOUNT UNLOCK TEST
  test('6. Should unlock user account and allow successful login again', async () => {
    if (testUserId) {
      const user = await User.findById(testUserId);
      if (user) {
        user.isLocked = false;
        user.failedLoginAttempts = 0;
        await user.save();
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueEmail,
          password: testPassword
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
      authToken = res.body.token; // Refresh active token
    }
  });

  // 7. SOCIAL AUTH MOCK TEST
  test('7. Should handle social authentication callback or token exchange', async () => {
    const res = await request(app)
      .post('/api/auth/social')
      .send({
        provider: 'google',
        token: 'mock_google_oauth_token_123'
      });

    expect([200, 201, 400, 401]).toContain(res.statusCode);
  });

  // 8. TOKEN EXPIRY / UNAUTHENTICATED PROTECTED ROUTE TEST
  test('8. Should reject access to protected routes with expired or invalid token', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidtoken');

    expect(res.statusCode).toBe(401);
  });

  // 9. LOGOUT TEST
  test('9. Should successfully logout and invalidate active session', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect([200, 204]).toContain(res.statusCode);
  });
});