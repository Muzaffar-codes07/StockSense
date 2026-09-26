// Live-database specs (*.db-spec.ts). Needs `docker compose up -d db` + migrations.
// Kept out of `npm test` so unit tests never need a database.
module.exports = {
  ...require('./jest.config'),
  testRegex: '.*\\.db-spec\\.ts$',
};
