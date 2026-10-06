import { Kafka } from 'kafkajs';
import { supabase } from '../config/supabase';

const kafka = new Kafka({
  clientId: 'farmchain-outbox-publisher',
  brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092']
});

const producer = kafka.producer();

async function publishOutboxEvents() {
  await producer.connect();
  console.log('Outbox Publisher: Connected to Kafka');

  // Poll loop
  setInterval(async () => {
    try {
      // Fetch pending events
      const { data: events, error } = await supabase
        .from('event_outbox')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching outbox events:', error);
        return;
      }

      if (!events || events.length === 0) return;

      for (const event of events) {
        try {
          await producer.send({
            topic: event.topic,
            messages: [
              {
                key: event.payload.shipment_id || event.payload.batch_id || event.event_id,
                value: JSON.stringify({
                  event_id: event.event_id,
                  event_type: event.event_type,
                  event_version: "1.0",
                  event_timestamp: event.created_at,
                  source: "retailer-service",
                  payload: event.payload
                })
              }
            ]
          });

          // Mark as PUBLISHED
          await supabase
            .from('event_outbox')
            .update({ status: 'PUBLISHED', published_at: new Date().toISOString() })
            .eq('id', event.id);

          console.log(`Published ${event.event_type} to ${event.topic}`);

        } catch (publishErr: any) {
          console.error(`Failed to publish event ${event.event_id}:`, publishErr);
          // Increment retry count
          await supabase
            .from('event_outbox')
            .update({ 
              retry_count: event.retry_count + 1, 
              last_error: publishErr.message || 'Unknown error'
            })
            .eq('id', event.id);
        }
      }
    } catch (err) {
      console.error('Outbox polling error:', err);
    }
  }, 5000); // Poll every 5 seconds
}

publishOutboxEvents().catch(console.error);
