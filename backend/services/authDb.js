import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import knex from 'knex'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const db = knex({
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'docuflow',
  },
})

export async function initAuthSchema() {
  const exists = await db.schema.hasTable('users')
  if (!exists) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary()
      table.string('email').unique().notNullable()
      table.string('passwordHash').notNullable()
      table.string('role').notNullable().defaultTo('user')
      table.string('name')
      table.timestamp('createdAt').defaultTo(db.fn.now())
    })
  }
}
