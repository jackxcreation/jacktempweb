# 🔐 Environment Variables & Production Secrets

To run Jack Essentials in production or staging, configure the following environment variables in your deployment dashboard (Render, Vercel, or VPS). Never commit `.env` files to version control.

| Variable Name | Description | Example / Format |
| :--- | :--- | :--- |
| `PORT` | HTTP server listening port | `5000` |
| `NODE_ENV` | Environment mode | `production` or `development` |
| `MONGO_URI` | MongoDB connection string with credentials | `mongodb+srv://user:pass@cluster.mongodb.net/jack_db` |
| `JWT_SECRET` | Secret key for signing and verifying JWT tokens | Secure random 64-character string |
| `RAZORPAY_KEY_ID` | Razorpay Merchant Key ID | `rzp_live_xxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET` | Razorpay Merchant Key Secret | Secure secret token |
| `RAZORPAY_WEBHOOK_SECRET` | Secret token configured in Razorpay Dashboard | Secure webhook secret string |
| `REDIS_URL` | Redis connection URL (TLS auto-detected for Upstash) | `redis://default:pass@redis-host:6379` |
| `WHATSAPP_API_KEY` | WhatsApp / Meta Cloud API Token for OTP delivery | Optional / Production token |