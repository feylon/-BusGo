import dataSource from './data-source';

async function run() {
  await dataSource.initialize();
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(`Migrations applied: ${applied.length ? applied.map((m) => m.name).join(', ') : 'none'}`);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
