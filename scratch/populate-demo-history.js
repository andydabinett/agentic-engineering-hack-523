import '../src/env.ts';
import { loadConfig } from '../src/config.ts';
import { ClickHouseCorrespondenceStore, createClickHouseClient } from '../src/services/clickhouse/client.ts';
import crypto from 'crypto';

async function main() {
  const config = loadConfig();
  if (!config.clickhouseHost || !config.clickhousePassword) {
    console.error('ClickHouse not configured in env!');
    return;
  }

  const store = new ClickHouseCorrespondenceStore(
    createClickHouseClient(config),
    config.clickhouseDatabase
  );

  console.log('Seeding fake SMS thread history into ClickHouse database:', config.clickhouseDatabase);

  const mockThreads = [
    {
      listingId: 'db-1',
      listerPhone: '+19175550142',
      listerName: 'Jamie Carter',
      listingSummary: '234 E 10th St #4B · East Village · 1BR · $3650',
      status: 'completed',
      proposedViewingAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
      calendarEventId: 'evt_demo_db1',
      messages: [
        { direction: 'outbound', body: "Hi Jamie! I'm Javier's assistant. Is the 1BR at 234 E 10th St still available? Javier is looking to schedule a viewing.", offsetMin: -60 },
        { direction: 'inbound', body: "Hi, yes it is! I'm showing it tomorrow afternoon or Thursday morning. What works?", offsetMin: -45 },
        { direction: 'outbound', body: "Great! Let's do tomorrow afternoon at 3 PM. Does that work for you?", offsetMin: -35 },
        { direction: 'inbound', body: "Perfect. Saturday at 3 PM is booked. See you at the building buzzer 4B.", offsetMin: -25 },
        { direction: 'outbound', body: "Awesome, thank you! Javier will be there.", offsetMin: -20 }
      ]
    },
    {
      listingId: 'db-2',
      listerPhone: '+16465550917',
      listerName: 'Priya Aggarwal',
      listingSummary: '511 E 7th St #2C · East Village · 1BR · $3950',
      status: 'negotiating_time',
      messages: [
        { direction: 'outbound', body: "Hi Priya, this is Javier's leasing agent. We saw your listing for the 1BR on E 7th St. Are you available for a showing this week?", offsetMin: -30 },
        { direction: 'inbound', body: "Hey! Yes, I can show it today at 6pm or Friday at 12pm.", offsetMin: -15 },
        { direction: 'outbound', body: "Let me check the calendar. I will get back to you shortly.", offsetMin: -5 }
      ]
    },
    {
      listingId: 'db-3',
      listerPhone: '+12125550488',
      listerName: 'Daniel Okafor',
      listingSummary: '17 St Marks Pl #3R · East Village · 1BR · $4200',
      status: 'awaiting_lister_reply',
      messages: [
        { direction: 'outbound', body: "Hello Daniel, I'm reaching out on behalf of Javier regarding 17 St Marks Pl #3R. We would love to tour it this weekend if possible.", offsetMin: -100 }
      ]
    }
  ];

  for (const t of mockThreads) {
    const threadId = crypto.randomUUID();
    console.log(`Creating thread ${threadId} for listing ${t.listingId}...`);

    // Create the thread row in ClickHouse
    await store.client.insert({
      table: `${store.database}.correspondence_threads`,
      values: [{
        thread_id: threadId,
        listing_id: t.listingId,
        lister_phone: t.listerPhone,
        lister_name: t.listerName,
        user_id: 'web-user',
        status: t.status,
        proposed_viewing_at: t.proposedViewingAt ? t.proposedViewingAt.slice(0, 19).replace('T', ' ') : null,
        calendar_event_id: t.calendarEventId || null,
        listing_summary: t.listingSummary,
        error_message: null,
        created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }],
      format: 'JSONEachRow'
    });

    // Create message rows
    if (t.messages && t.messages.length > 0) {
      const rows = t.messages.map((m, index) => {
        const sentAt = new Date(Date.now() + m.offsetMin * 60000);
        return {
          message_id: crypto.randomUUID(),
          thread_id: threadId,
          direction: m.direction,
          body: m.body,
          twilio_sid: `SM_fake_demo_${m.direction}_${index}`,
          sent_at: sentAt.toISOString().slice(0, 19).replace('T', ' ')
        };
      });

      await store.client.insert({
        table: `${store.database}.correspondence_messages`,
        values: rows,
        format: 'JSONEachRow'
      });
      console.log(`Inserted ${rows.length} messages for thread ${threadId}`);
    }
  }

  console.log('Finished seeding fake thread history!');
}

main().catch(err => {
  console.error('Error seeding thread history:', err);
});
