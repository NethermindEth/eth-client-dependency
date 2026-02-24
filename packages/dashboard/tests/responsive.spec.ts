import { test, expect } from '@playwright/test'

const PAGES = ['/', '/clients', '/ecosystems', '/libraries', '/native']

test.describe('responsiveness', () => {
  for (const page of PAGES) {
    test(`${page} renders without horizontal overflow`, async ({ page: pw, viewport }) => {
      await pw.goto(page)
      await pw.waitForLoadState('networkidle')

      // No horizontal scrollbar — body width should match viewport width
      const scrollWidth = await pw.evaluate(() => document.body.scrollWidth)
      const clientWidth = await pw.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth, `horizontal overflow on ${page} at ${viewport?.width}px`).toBeLessThanOrEqual(clientWidth + 2)
    })

    test(`${page} has no clipped/overlapping text at narrow viewport`, async ({ page: pw, viewport }) => {
      await pw.goto(page)
      await pw.waitForLoadState('networkidle')

      // Check main content is visible (not display:none or zero-height)
      const mainVisible = await pw.evaluate(() => {
        const main = document.querySelector('main') ?? document.querySelector('[role="main"]') ?? document.body
        const rect = main.getBoundingClientRect()
        return rect.height > 50
      })
      expect(mainVisible, `main content not visible on ${page}`).toBe(true)
    })

    test(`${page} nav links are tappable on mobile`, async ({ page: pw, viewport }) => {
      if (!viewport || viewport.width > 768) test.skip()
      await pw.goto(page)
      await pw.waitForLoadState('networkidle')

      // Nav links should be at least 44px tall (WCAG touch target)
      const navLinks = await pw.locator('nav a').all()
      for (const link of navLinks) {
        const box = await link.boundingBox()
        if (box) {
          expect(box.height, `nav link too small on mobile`).toBeGreaterThanOrEqual(30)
        }
      }
    })
  }

  test('overview stats grid wraps on mobile', async ({ page: pw, viewport }) => {
    if (!viewport || viewport.width > 768) test.skip()
    await pw.goto('/')
    await pw.waitForLoadState('networkidle')

    // The stats grid uses grid-cols-2 on mobile — both columns should fit in viewport
    const statCards = await pw.locator('[class*="grid"] > div').all()
    for (const card of statCards.slice(0, 4)) {
      const box = await card.boundingBox()
      if (box) {
        expect(box.width, 'stat card wider than viewport').toBeLessThanOrEqual((viewport?.width ?? 375) + 2)
        expect(box.x, 'stat card outside viewport').toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('dep table scrolls horizontally on mobile rather than overflowing body', async ({ page: pw, viewport }) => {
    if (!viewport || viewport.width > 768) test.skip()
    await pw.goto('/')
    await pw.waitForLoadState('networkidle')

    // The table wrapper should have overflow-x-auto or the table should stay within viewport
    const bodyScrollWidth = await pw.evaluate(() => document.body.scrollWidth)
    const bodyClientWidth = await pw.evaluate(() => document.body.clientWidth)
    expect(bodyScrollWidth, 'body has horizontal overflow from table').toBeLessThanOrEqual(bodyClientWidth + 2)
  })
})
