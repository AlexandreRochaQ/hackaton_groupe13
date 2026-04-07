import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { mkdirSync } from 'fs'
import knex from 'knex'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sqliteDir = resolve(__dirname, '../../data')
const sqliteFile = resolve(sqliteDir, 'auth.sqlite')

mkdirSync(sqliteDir, { recursive: true })

export const db = knex({
  client: 'sqlite3',
  connection: {
    filename: sqliteFile,
  },
  useNullAsDefault: true,
})

export async function initAuthSchema() {
  const usersExists = await db.schema.hasTable('users')
  if (!usersExists) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary()
      table.string('email').unique().notNullable()
      table.string('passwordHash').notNullable()
      table.string('role').notNullable().defaultTo('user')
      table.string('name')
      table.timestamp('createdAt').defaultTo(db.fn.now())
    })
  }

  const documentsExists = await db.schema.hasTable('documents')
  if (!documentsExists) {
    await db.schema.createTable('documents', (table) => {
      table.string('id', 36).primary()
      table.string('batch_id', 36).notNullable().index()
      table.string('name').notNullable()
      table.string('type').notNullable().defaultTo('inconnu')
      table.datetime('date_upload', { precision: 3 }).notNullable().defaultTo(db.fn.now())
      table.integer('utilisateur_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
      table.string('mongo_id', 50).nullable().index()
      table.string('status', 30).notNullable().defaultTo('uploaded')
      table.timestamp('created_at').defaultTo(db.fn.now())
      table.timestamp('updated_at').defaultTo(db.fn.now())
    })
  }
}
