import fs from 'node:fs/promises'

const OWNER = process.env.FIELD_INDEX_OWNER || 'MichaelWave369'
const INDEX_PATH = new URL('../data/repo-index.json', import.meta.url)
const OVERRIDES_PATH = new URL('../data/repo-index-overrides.json', import.meta.url)
const MARKDOWN_PATH = new URL('../FIELD_INDEX.md', import.meta.url)

const overrides = JSON.parse(await fs.readFile(OVERRIDES_PATH, 'utf8'))
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'MichaelWave369-profile-field-index'
}
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

const discovered = []
for (let page = 1; ; page += 1) {
  const url = `https://api.github.com/users/${OWNER}/repos?type=owner&sort=updated&per_page=100&page=${page}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`GitHub public repository fetch failed: ${response.status} ${response.statusText}`)
  const batch = await response.json()
  discovered.push(...batch)
  if (batch.length < 100) break
}

const featured = new Set(overrides.featured || [])
const categoryOverrides = overrides.category_overrides || {}
const labels = overrides.category_labels || {}
const allowedCategories = overrides.allowed_categories || []
const categoryOrder = [
  'CORE_SYSTEMS','INFRASTRUCTURE','COLLABORATORS','RESEARCH','CREATIVE',
  'GAMES_WORLDS','COMMUNITY_APPS','UTILITIES','FIELD_META','ARCHIVE_REFERENCE','EXPERIMENTAL'
]

const repos = discovered
  .filter((repo) => !repo.private)
  .map((repo) => {
    const category = categoryOverrides[repo.name] || overrides.default_category || 'EXPERIMENTAL'
    let status = 'ACTIVE'
    if (category === 'ARCHIVE_REFERENCE' || repo.archived) status = 'REFERENCE'
    if (category === 'EXPERIMENTAL') status = 'EXPERIMENTAL'
    if (featured.has(repo.name)) status = 'FEATURED'

    return {
      name: repo.name,
      url: repo.html_url,
      category,
      status,
      featured: featured.has(repo.name),
      archived: Boolean(repo.archived),
      visibility: 'public',
      description: repo.description || null,
      language: repo.language || null,
      fork: Boolean(repo.fork),
      updated_at: repo.updated_at || null
    }
  })
  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

const categories = {}
for (const repo of repos) categories[repo.category] = (categories[repo.category] || 0) + 1

const today = new Date().toISOString().slice(0, 10)
const snapshot = {
  schema_version: '1.0',
  owner: OWNER,
  generated_at: today,
  source: 'GitHub public repositories endpoint',
  public_repository_count: repos.length,
  note: 'Private repositories are intentionally excluded from this public index.',
  categories,
  repos
}

function link(name) {
  return `[${name}](https://github.com/${OWNER}/${name})`
}

let md = '# Enter the Field — Public Repository Index\n\n'
md += '> **A map of the public MichaelWave369 ecosystem.**  \n'
md += '> Generated from public GitHub repositories only. Private repositories are intentionally omitted.\n\n'
md += `**${repos.length} public repositories indexed** · Snapshot: ${today}\n\n`
md += 'This is the deeper navigation layer behind the [MichaelWave369 profile](./README.md). The profile is the front door; this file is the map.\n\n'
md += '## Start here\n\n'
md += '| Lane | Good first stops |\n|---|---|\n'
md += `| **Core Systems** | ${link('PhiOS')} · ${link('Infinite-Porch')} · ${link('Commonline')} |\n`
md += `| **Computational Collaborators** | ${link('SuperPhiVessel')} · ${link('SIcologist')} · ${link('BrainC')} |\n`
md += `| **Research** | ${link('NestedBubbleGear')} · ${link('governance-drift-rsdc')} · ${link('enter-the-field-research')} |\n`
md += `| **Creative** | ${link('Domistika')} · ${link('Auralith369')} · ${link('WaveForgeStudio')} |\n`
md += `| **Games & Worlds** | ${link('PhiCade')} · ${link('HomeBass')} · ${link('NightCircuit')} |\n\n`
md += '## How to read this index\n\n'
md += '- **FEATURED** — a strong current entry point into the ecosystem.\n'
md += '- **ACTIVE** — public project currently represented in the Field.\n'
md += '- **EXPERIMENTAL** — exploratory or not yet confidently classified.\n'
md += '- **REFERENCE** — archive/reference surface rather than a primary active system.\n\n'
md += 'Repository visibility on GitHub is the source boundary for this index. **Private repos are never emitted into the public catalog.**\n\n---\n\n'

for (const category of categoryOrder) {
  const items = repos.filter((repo) => repo.category === category)
  if (!items.length) continue
  md += `## ${labels[category] || category} · ${items.length}\n\n`
  md += '| Repository | Status |\n|---|---|\n'
  for (const repo of items) md += `| [${repo.name}](${repo.url}) | \\`${repo.status}\\` |\n`
  md += '\n'
}

for (const category of Object.keys(categories)) {
  if (!allowedCategories.includes(category)) throw new Error(`Unapproved category emitted: ${category}`)
}

md += '---\n\n## Field principle\n\n'
md += '> **The public index explains the Field. The private operator surfaces operate it.**\n\n'
md += 'That boundary is intentional.\n\n'
md += '\\`REALITY IS THE CUSTOMER.\\` · \\`CAPABILITY ≠ AUTHORITY.\\` · \\`KEEP THE EVIDENCE ATTACHED.\\`\n'

await fs.writeFile(INDEX_PATH, JSON.stringify(snapshot, null, 2) + '\n')
await fs.writeFile(MARKDOWN_PATH, md)
console.log(`field_index_refreshed public=${repos.length}`)
