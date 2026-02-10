const express = require('express');
const verifyToken = require('./verifyToken');
const connection = require('../database').connect;

const router = express.Router();

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

const getTodayEasternDateKey = () => {
  // Keep original behavior (UTC-5 style offset)
  return new Date(new Date().getTime() + -300 * 60 * 1000).toISOString().split('T')[0];
};

const requireAuth = (req, res) => {
  verifyToken.validateToken(req, res);
  // If auth middleware already sent a response, stop.
  return !res.headersSent;
};

const isValidDateKey = (value) => DATE_KEY_REGEX.test(String(value || ''));

const toDeliveryPayload = (body, { includeTimestamp = false } = {}) => {
  const payload = {
    cooler_size: String(body.cooler_size || '').toUpperCase(),
    cooler_num: body.cooler_num,
    ice_type: String(body.ice_type || '').toUpperCase(),
    delivery_address: body.delivery_address,
    customer_name: body.customer_name,
    customer_phone: body.customer_phone,
    customer_email: body.customer_email,
    start_date: body.start_date,
    end_date: body.end_date,
    neighborhood: body.neighborhood,
    special_instructions: body.special_instructions,
    bag_limes: body.bag_limes,
    bag_lemons: body.bag_lemons,
    bag_oranges: body.bag_oranges,
    marg_salt: body.marg_salt,
    freeze_pops: body.freeze_pops == null ? 0 : body.freeze_pops,
    tip: body.tip,
    deliverytime: body.deliverytime,
    dayornight: body.dayornight,
  };

  if (includeTimestamp) payload.timestamp = new Date();
  return payload;
};

const sendServerError = (res, err) => {
  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
};

router.get('/gettoday', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const today = getTodayEasternDateKey();
    const sql = `
      SELECT *
      FROM delivery
      WHERE start_date <= ?
        AND end_date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `;
    const results = await runQuery(sql, [today]);
    return res.status(200).json(results);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/getending', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const today = getTodayEasternDateKey();
    const sql = `SELECT * FROM delivery WHERE end_date = ?`;
    const results = await runQuery(sql, [today]);
    return res.status(200).json(results);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/get/:startDate/:endDate', (req, res) => {
  verifyToken.validateToken(req, res);

  const { startDate, endDate } = req.params;

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate are required' });
  }
  if (startDate > endDate) {
  return res.status(400).json({ message: 'startDate must be <= endDate' });
}


  const sql = `
    SELECT *
    FROM delivery
    WHERE start_date <= ? AND end_date >= ?
  `;

  connection.query(sql, [endDate, startDate], (err, results) => {
    if (err) {
      return res.status(500).json({ message: err.message });
    }

    return res.status(200).json(results);
  });
});

router.get('/getall', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const sql = `
      SELECT *
      FROM delivery
      JOIN neighborhoods ON delivery.neighborhood = neighborhoods.neighborhood_id
      WHERE YEAR(start_date) >= YEAR(NOW())
    `;
    const results = await runQuery(sql);
    return res.status(200).json(results);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/getlastyear', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const sql = `
      SELECT *
      FROM delivery
      JOIN neighborhoods ON delivery.neighborhood = neighborhoods.neighborhood_id
      WHERE YEAR(start_date) = YEAR(NOW()) - 1
    `;
    const results = await runQuery(sql);
    return res.status(200).json(results);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/getordered', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const sql = `
      SELECT *
      FROM delivery
      JOIN neighborhoods ON delivery.neighborhood = neighborhoods.neighborhood_id
      ORDER BY start_date ASC
    `;
    const results = await runQuery(sql);
    return res.status(200).json(results);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/tips/:start_date/:end_date', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const { start_date, end_date } = req.params;

    if (!isValidDateKey(start_date) || !isValidDateKey(end_date)) {
      return res.status(400).json({ message: 'start_date and end_date must be YYYY-MM-DD' });
    }
    if (start_date > end_date) {
      return res.status(400).json({ message: 'start_date must be <= end_date' });
    }

    const sql = `
      SELECT tip
      FROM delivery
      WHERE start_date <= ?
        AND end_date >= ?
    `;
    const results = await runQuery(sql, [end_date, start_date]);
    return res.status(200).json(results);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const sql = `
      SELECT *
      FROM delivery
      JOIN neighborhoods ON delivery.neighborhood = neighborhoods.neighborhood_id
      WHERE delivery.id = ?
    `;
    const results = await runQuery(sql, [id]);
    return res.status(200).json(results);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.post('/add', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const delivery = toDeliveryPayload(req.body, { includeTimestamp: true });
    const sql = 'INSERT INTO delivery SET ?';
    await runQuery(sql, [delivery]);
    return res.status(200).json(delivery);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.put('/edit/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const delivery = toDeliveryPayload(req.body);
    const sql = 'UPDATE delivery SET ? WHERE id = ?';
    await runQuery(sql, [delivery, id]);
    return res.status(200).json(delivery);
  } catch (err) {
    return sendServerError(res, err);
  }
});

router.delete('/delete/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const sql = 'DELETE FROM delivery WHERE id = ?';
    await runQuery(sql, [id]);
    return res.status(200).json({ message: 'Reservation deleted' });
  } catch (err) {
    return sendServerError(res, err);
  }
});

module.exports = router;
