# Commander backend (no PostgreSQL)

The commander mobile flow can run **without PostgreSQL** using either an in-memory store or **DynamoDB Local**.

## Quick start (in-memory, no DB)

```bash
cd emertgency-backend
npm run dev:commander
```

- Server runs on **port 5010**
- **Login:** `commander@test.com` / `commander123`
- Data is in-memory only (resets on restart)

## Port conflict (5003 in use)

If you see `EADDRINUSE: address already in use :::5010`:

1. Use another port: `PORT=5011 npm run dev:commander`
2. Then in the mobile app set the commander API URL to that port (e.g. `http://localhost:5011/api` or `EXPO_PUBLIC_COMMANDER_API_URL=http://YOUR_IP:5011/api` for Expo Go on device).

Or find and stop the process using 5010:

```bash
lsof -i :5010
kill -9 <PID>
```

## Optional: DynamoDB Local

To use **Local DynamoDB** for commander data:

1. **Start DynamoDB Local** (Docker):

   ```bash
   npm run dynamodb:start
   ```

   Or manually: `docker run -d -p 8000:8000 --name dynamodb-commander amazon/dynamodb-local`

2. **Start commander with DynamoDB:**

   ```bash
   USE_DYNAMODB=1 npm run dev:commander
   ```

3. Same login: `commander@test.com` / `commander123`. Tables are created and seeded on first request.

## Mobile app (Expo) URL

- **Simulator:** default `http://localhost:5010/api` is used.
- **Physical device (Expo Go):** set your machine’s IP in the app, e.g. create `frontend/.env` with:
  ```
  EXPO_PUBLIC_COMMANDER_API_URL=http://100.69.38.177:5010/api
  ```
  Replace with your computer’s LAN IP. Restart Expo after changing `.env`.
