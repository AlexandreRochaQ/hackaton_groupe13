import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import knex from 'knex'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const db = knex({
  client: 'sqlite3',
  connection: {
    filename: resolve(__dirname, '../data/auth.sqlite'),
  },
  useNullAsDefault: true,
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
