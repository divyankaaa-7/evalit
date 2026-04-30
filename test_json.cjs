const fs = require('fs');
const db = require('better-sqlite3')('evalit.db');

const rows = db.prepare('SELECT id, digitized_text_json FROM papers').all();

for (const row of rows) {
  try {
    const parsed = JSON.parse(row.digitized_text_json);
    console.log(`${row.id}: PARSE SUCCESS! Array length: ${parsed.length}`);
  } catch(e) {
    console.log(`${row.id}: PARSE ERROR!`, e.message);
  }
}
