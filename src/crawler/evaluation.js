import { loadCriteria } from '../config/criteria.js';
import { getListingAnalytics } from '../clickhouse/sync.js';
import { startCorrespondence } from '../bridge/correspondenceClient.js';

/**
 * Evaluates all listings pending evaluation in SQLite.
 * Uses OpenRouter LLM and ClickHouse price delta analytics to decide suitability.
 * If matched and phone number is present, kicks off Twilio SMS outreach.
 *
 * @param {import('../listings/repository.js').ListingRepository} repo
 */
export async function evaluateListings(repo) {
  const criteria = loadCriteria();
  if (!criteria || !criteria.readyToSearch) {
    console.log('[evaluation] User criteria not set or not ready to search. Skipping evaluation.');
    return;
  }

  // Get active listings that are still pending evaluation
  const pending = repo.listPendingEvaluation({ limit: 50 });
  if (!pending.length) {
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[evaluation] OPENROUTER_API_KEY is not set. Skipping LLM evaluation.');
    return;
  }

  console.log(`[evaluation] Starting evaluation of ${pending.length} pending listing(s) against user criteria...`);

  for (const listing of pending) {
    try {
      console.log(`[evaluation] Reviewing db-${listing.id}: "${listing.title}" | Rent: ${listing.rent_hint}`);

      // 1. Retrieve ClickHouse price delta and median rent analytics
      let analytics = null;
      if (process.env.CLICKHOUSE_HOST) {
        try {
          analytics = await getListingAnalytics(listing.id);
        } catch (err) {
          console.warn(`[evaluation] Could not fetch ClickHouse analytics for listing db-${listing.id}: ${err.message}`);
        }
      }

      // 2. Query OpenRouter LLM to check criteria match
      const prompt = `
User Search Criteria:
${JSON.stringify(criteria, null, 2)}

Listing Details:
- ID: db-${listing.id}
- Title: ${listing.title}
- Neighborhood: ${listing.neighborhood || listing.borough}
- Rent: ${listing.rent_hint}
- Bedrooms: ${listing.bedrooms}
- Bathrooms: ${listing.bathrooms}
- Description: ${listing.snippet || ''}
- URL: ${listing.listing_link || listing.url}

ClickHouse Analytics:
${analytics ? JSON.stringify(analytics, null, 2) : 'No analytics available.'}

Evaluate if this listing makes sense for the user based on their criteria.
Rules to apply:
1. The rent must be within the user's max budget (maxPrice), or extremely close (within 5%).
2. Bedrooms must match (e.g. 1BR vs 1BR). If the user specified a Studio, then bedrooms = 0 or 'studio' is a match.
3. Neighborhood must match or be in the user's preferred area if specified.
4. Check the snippet/description for any user dealBreakers (e.g., 'no-elevator', 'broker-fee'). If any deal-breaker is mentioned in the listing, do NOT match.
5. Suitability increases if listing matches desired amenities (e.g. pet-friendly, elevator, laundry-in-unit, dishwasher).

You MUST respond with a JSON object. Do not include markdown formatting or backticks around the JSON. Return only the raw JSON.
JSON format:
{
  "matches": true,
  "reason": "Short explanation referencing rent, bedrooms, neighborhood, and amenities or deal-breakers."
}
`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/andydabinett/agentic-engineering-hack-523',
          'X-Title': 'Javier NYC Rental Concierge'
        },
        body: JSON.stringify({
          model: process.env.EVALUATION_MODEL || 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are Javier, the NYC Rent Concierge listing validator agent. You evaluate rental listings and return a JSON object with matches (boolean) and reason (string).'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      const textResponse = data.choices?.[0]?.message?.content?.trim();
      if (!textResponse) {
        throw new Error('Received empty response from OpenRouter');
      }

      let result;
      try {
        const cleaned = textResponse.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        result = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error(`Failed to parse JSON response: "${textResponse}". Error: ${parseErr.message}`);
      }

      console.log(`[evaluation] Listing db-${listing.id} evaluation: matches=${result.matches} | reason: ${result.reason}`);

      if (result.matches) {
        // Mark as matched in SQLite
        repo.updateEvaluationStatus(listing.id, 'matched');

        // 3. Initiate Twilio correspondence if a broker phone is available
        if (listing.agent_phone) {
          // Since trial accounts cannot text unverified numbers, route all outreach to the Twilio Virtual Phone (+18777804236) for the demo.
          const targetPhone = '+18777804236';
          console.log(`[evaluation] Listing db-${listing.id} is a MATCH. Triggering autonomous SMS outreach to Twilio Virtual Phone (${targetPhone}) representing broker...`);
          try {
            const summary = [
              listing.address || listing.title,
              listing.neighborhood,
              listing.bedrooms ? `${listing.bedrooms}BR` : '',
              listing.rent_hint
            ].filter(Boolean).join(' · ');

            await startCorrespondence({
              listingId: `db-${listing.id}`,
              listerPhone: targetPhone,
              listerName: listing.agent_name || undefined,
              listingSummary: summary
            });
            console.log(`[evaluation] Twilio outreach thread initiated successfully for listing db-${listing.id}`);
          } catch (corrErr) {
            console.error(`[evaluation] Failed to start SMS correspondence for matched listing db-${listing.id}: ${corrErr.message}. Make sure Hono server is running (npm run server).`);
          }
        } else {
          console.log(`[evaluation] Listing db-${listing.id} matches criteria but has no broker phone on file. Skipping outreach.`);
        }
      } else {
        // Mark as no_match in SQLite
        repo.updateEvaluationStatus(listing.id, 'no_match');
      }

    } catch (err) {
      console.error(`[evaluation] Error evaluating listing db-${listing.id}:`, err.message);
    }
  }
}
