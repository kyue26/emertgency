const pool = require('./database');

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const idempotencyMiddleware = async (req, res, next) => {
  // Only applies to mutating methods
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  const key = req.headers['idempotency-key'];

  // No header — pass through unchanged (keeps existing clients working)
  if (!key) {
    return next();
  }

  // Validate UUID v4 format
  if (!UUID_V4_RE.test(key)) {
    return res.status(400).json({
      success: false,
      message: 'Idempotency-Key must be a valid UUID v4'
    });
  }

  const professionalId = req.user.professional_id;

  try {
    // Cache hit check — key exists, not expired, same professional
    const cached = await pool.query(
      `SELECT response_status, response_body
       FROM idempotency_keys
       WHERE key = $1
         AND professional_id = $2
         AND expires_at > CURRENT_TIMESTAMP`,
      [key, professionalId]
    );

    if (cached.rows.length > 0) {
      const { response_status, response_body } = cached.rows[0];
      return res.status(response_status).json(response_body);
    }
  } catch (err) {
    console.error('Idempotency cache lookup error:', err.message);
    // Fail open — let the request proceed
    return next();
  }

  // Cache miss — intercept res.json to store the response after success
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    // Restore original so it sends normally
    res.json = originalJson;

    // Only cache 2xx responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await pool.query(
          `INSERT INTO idempotency_keys
             (key, professional_id, method, path, response_status, response_body, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + INTERVAL '24 hours')
           ON CONFLICT (key) DO NOTHING`,
          [
            key,
            professionalId,
            req.method,
            req.path,
            res.statusCode,
            JSON.stringify(body)
          ]
        );
      } catch (err) {
        console.error('Idempotency cache write error:', err.message);
        // Fail open — do not block the response
      }
    }

    return res.json(body);
  };

  next();
};

module.exports = { idempotencyMiddleware };
