#!/usr/bin/env node
/**
 * Draws the app icons in public/icons/ from public/icon.svg, using the
 * Chromium that Playwright drives. Run it again if the icon changes:
 * `npm run icons`. Not part of the build or CI (needs Playwright).
 *
 * - icon-192.png, icon-512.png: the tile with rounded corners, as the SVG.
 * - icon-512-maskable.png, apple-touch-icon.png: the tile filled to the
 *   corners, for phones that cut their own shape out of it.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const svg = readFileSync('public/icon.svg', 'utf8')
// The same drawing with square corners, for maskable and Apple icons.
const square = svg.replace('rx="12"', 'rx="0"')
// Maskable icons keep the art inside the middle 80%.
const maskable = square.replace('<g ', '<g transform="translate(6.4 6.4) scale(0.8)" ').replace('<circle ', '<circle transform="translate(6.4 6.4) scale(0.8)" ')

const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
async function shot(markup, size, file) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground: true })
  console.log(`wrote ${OUT}/${file}`)
}
await shot(svg, 192, 'icon-192.png')
await shot(svg, 512, 'icon-512.png')
await shot(maskable, 512, 'icon-512-maskable.png')
await shot(square, 180, 'apple-touch-icon.png')
await browser.close()
