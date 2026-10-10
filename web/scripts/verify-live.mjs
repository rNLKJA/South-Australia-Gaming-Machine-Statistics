#!/usr/bin/env node
// Verify SA Gaming Machine Statistics production site
import { chromium } from '@playwright/test'

const BASE_URL = 'https://sa-gaming-machine-stats.vercel.app'

const ROUTES = [
  '/',
  '/statewide',
  '/councils',
  '/licences',
  '/manufacturers',
  '/data-quality',
  '/analysis',
  '/ask',
  '/methods',
  '/downloads',
]

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
]

async function verify() {
  const browser = await chromium.launch({ channel: 'chrome' })
  const results = []

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()

    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    for (const route of ROUTES) {
      const url = `${BASE_URL}${route}`
      try {
        const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
        const status = response?.status() ?? 0
        const title = await page.title()

        // Check for gambling harm note
        const harmNote = await page.locator('text=/Gambling Help/i').count()

        results.push({
          route,
          viewport: viewport.name,
          status,
          title,
          harmNote: harmNote > 0,
          consoleErrors: [...consoleErrors],
        })

        consoleErrors.length = 0
      } catch (err) {
        results.push({
          route,
          viewport: viewport.name,
          status: 0,
          error: err.message,
        })
      }
    }

    await context.close()
  }

  await browser.close()

  // Report
  console.log(JSON.stringify(results, null, 2))

  const failures = results.filter(
    (r) => r.status !== 200 || (r.consoleErrors && r.consoleErrors.length > 0)
  )

  if (failures.length > 0) {
    console.error('\n❌ FAILURES:')
    failures.forEach((f) => {
      console.error(`  ${f.route} @ ${f.viewport}: status ${f.status}`)
      if (f.consoleErrors?.length) {
        f.consoleErrors.forEach((e) => console.error(`    Console error: ${e}`))
      }
      if (f.error) console.error(`    Error: ${f.error}`)
    })
    process.exit(1)
  }

  const noHarmNote = results.filter((r) => r.viewport === '1440x900' && !r.harmNote)
  if (noHarmNote.length > 0) {
    console.warn('\n⚠️  Missing gambling harm note on:', noHarmNote.map((r) => r.route).join(', '))
  }

  console.log('\n✅ All routes returned 200, no console errors.')
}

verify().catch((err) => {
  console.error(err)
  process.exit(1)
})
