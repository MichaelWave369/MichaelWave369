import fs from 'node:fs/promises'

const index = JSON.parse(await fs.readFile(new URL('../data/repo-index.json', import.meta.url), 'utf8'))
const overrides = JSON.parse(await fs.readFile(new URL('../data/repo-index-overrides.json', import.meta.url), 'utf8'))
const markdown = await fs.readFile(new URL('../FIELD_INDEX.md', import.meta.url), 'utf8')

const fail = (message) => {
  console.error(`field_index_invalid: ${message}`)
  process.exit(1)
}

if (index.schema_version !== '1.0') fail('unsupported schema_version')
if (index.owner !== 'MichaelWave369') fail('unexpected owner')
if (!Array.isArray(index.repos)) fail('repos must be an array')

const allowedCategories = new Set(overrides.allowed_categories || [])
const allowedStatuses = new Set(overrides.allowed_statuses || [])
const seen = new Set()

for (const repo of index.repos) {
  if (!repo || typeof repo !== 'object') fail('repo entry must be an object')
  if (!repo.name || typeof repo.name !== 'string') fail('repo name missing')
  if (seen.has(repo.name)) fail(`duplicate repo ${repo.name}`)
  seen.add(repo.name)

  if (repo.visibility !== 'public') fail(`${repo.name} is not explicitly public`)
  if (repo.private === true) fail(`${repo.name} leaked private=true`)
  if (!allowedCategories.has(repo.category)) fail(`${repo.name} has invalid category ${repo.category}`)
  if (!allowedStatuses.has(repo.status)) fail(`${repo.name} has invalid status ${repo.status}`)
  if (!repo.url?.startsWith('https://github.com/MichaelWave369/')) fail(`${repo.name} has unexpected URL`)
}

if (index.public_repository_count !== index.repos.length) {
  fail(`public_repository_count=${index.public_repository_count} but repos.length=${index.repos.length}`)
}

const counted = {}
for (const repo of index.repos) counted[repo.category] = (counted[repo.category] || 0) + 1
for (const [category, count] of Object.entries(counted)) {
  if (index.categories?.[category] !== count) fail(`category count mismatch for ${category}`)
}

if (!markdown.includes(`**${index.repos.length} public repositories indexed**`)) {
  fail('FIELD_INDEX.md count does not match JSON index')
}
if (!markdown.includes('Private repos are never emitted into the public catalog.')) {
  fail('privacy boundary statement missing from FIELD_INDEX.md')
}

console.log(`field_index_ok public=${index.repos.length}`)
