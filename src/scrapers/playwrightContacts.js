/**
 * Playwright fallback for contact fields Nimble cannot extract
 * (e.g. Craigslist click-to-reveal phone numbers).
 */

import { parseContacts } from '../nimble/contactParser.js';
import { isPostingUnavailable } from '../nimble/craigslistExtract.js';

let browserPromise = null;

const CL_PHONE_CLICK_SELECTORS = [
  'p.show-phone a',
  '#show-phone',
  '.show-phone',
  '#show-contact-info',
  '.show-contact-info',
  'button.reply-button',
  '.reply-button',
  'a[href^="tel:"]',
];

const SE_PHONE_CLICK_SELECTORS = [
  '[data-testid="contact-agent"]',
  'button:has-text("Contact")',
  'a[href^="tel:"]',
];

export function needsPlaywrightFallback(contacts, source, { requireCraigslistPhone = false } = {}) {
  if (source === 'craigslist') {
    if (requireCraigslistPhone) return !contacts.agentPhone;
    return !contacts.agentPhone && !contacts.agentEmail;
  }
  return !contacts.agentPhone && !contacts.agentEmail && !contacts.agentName;
}

export function mergeContacts(primary, fallback) {
  return {
    agentName: primary.agentName || fallback.agentName,
    agencyName: primary.agencyName || fallback.agencyName,
    agentEmail: primary.agentEmail || fallback.agentEmail,
    agentPhone: primary.agentPhone || fallback.agentPhone,
    allPhones: [...new Set([...(primary.allPhones || []), ...(fallback.allPhones || [])])],
    allEmails: [...new Set([...(primary.allEmails || []), ...(fallback.allEmails || [])])],
  };
}

async function getBrowser() {
  if (!browserPromise) {
    const { chromium } = await import('playwright');
    const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
    browserPromise = chromium.launch({ headless });
  }
  return browserPromise;
}

export async function closePlaywrightBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 1500 })) {
        await locator.click({ timeout: 3000 });
        await page.waitForTimeout(1200);
        return selector;
      }
    } catch {
      // try next selector
    }
  }
  return null;
}

async function collectTelLinks(page) {
  try {
    return await page.$$eval('a[href^="tel:"]', (els) =>
      els.map((el) => el.getAttribute('href')).filter(Boolean),
    );
  } catch {
    return [];
  }
}

export async function extractContactsWithPlaywright(url, source) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });

    if (source === 'craigslist') {
      await page
        .waitForSelector('#postingbody, #has_been_removed, .removed', { timeout: 45_000 })
        .catch(() => {});

      const held = await page.locator('#has_been_removed, .removed h2').first().isVisible().catch(() => false);
      const html = await page.content();
      if (held || isPostingUnavailable(html)) {
        return { unavailable: true, contacts: null };
      }

      await clickFirstVisible(page, CL_PHONE_CLICK_SELECTORS);
    } else if (source === 'streeteasy') {
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      await clickFirstVisible(page, SE_PHONE_CLICK_SELECTORS);
    }

    const html = await page.content();
    const innerText = await page.evaluate(() => document.body?.innerText || '');
    const telLinks = await collectTelLinks(page);
    const blob = [html, innerText, telLinks.join('\n')].join('\n');

    const contacts = parseContacts(blob, source, { listingUrl: url });
    return { unavailable: false, contacts, clicked: true };
  } finally {
    await page.close();
  }
}
