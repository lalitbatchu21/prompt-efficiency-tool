DROP TABLE IF EXISTS eco_logs;
CREATE TABLE eco_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER,
  tokens INTEGER,
  water_ml REAL,
  energy_wh REAL
);