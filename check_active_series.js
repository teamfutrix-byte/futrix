const { Client } = require('pg');
const { dbConfig } = require('./config/db');

async function check() {
  const db = new Client(dbConfig);
  await db.connect();
  const { rows } = await db.query(
    "SELECT series_id, COUNT(*) FROM public.questions GROUP BY series_id"
  );
  console.log("Questions grouped by series_id:", JSON.stringify(rows, null, 2));
  await db.end();
}
check();
