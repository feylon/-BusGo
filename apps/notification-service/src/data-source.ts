import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseOptions } from '@bus/config';
import { join } from 'node:path';

export const dataSourceOptions = (): DataSourceOptions => ({
  ...databaseOptions('DATABASE_URL'),
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'migrations',
  synchronize: false,
});

export default new DataSource(dataSourceOptions());
