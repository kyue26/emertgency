# Emertgency Backend

Express.js API server with PostgreSQL database for the Emertgency Emergency Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure your database credentials in `.env`

4. Set up the database:
```bash
psql -U emert -d emertgency_db -f database/schema.sql
```

## Development

Run the development server with auto-reload:
```bash
npm run dev
```

## Production

Start the server:
```bash
npm start
```

## API Documentation

See main README.md for full API documentation.

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRES_IN` - Token expiration time
- `CORS_ORIGIN` - Allowed CORS origin
