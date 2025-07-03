import { Kafka } from "kafkajs";
import pkg from 'pg';
import * as Minio from 'minio';
import client from 'prom-client';

const { Client } = pkg;

const kafka = new Kafka({ brokers: ["kafka:9092"] });
const consumer = kafka.consumer({ groupId: "clickstream-group" });

const pgClient = new Client({ user: "user", password: "password", database: "clickstream", host: "postgres" });
pgClient.connect();

const minioClient = new Minio.Client({
    endPoint: "minio",
    port: 9000,
    useSSL: false,
    accessKey: "minioadmin",
    secretKey: "minioadmin",
});

const eventProcessingDuration = new client.Histogram({
    name: "event_processing_duration_seconds",
    help: "Time taken to process events",
    buckets: [0.1, 0.5, 1, 2, 5],
});

const eventsByType = new client.Counter({
    name: "events_processed_total",
    help: "Total number of events processed by type",
    labelNames: ['event_type'],
});

const failedEvents = new client.Counter({
    name: "failed_events_total",
    help: "Number of failed event processing attempts",
    labelNames: ['stage'],
});

async function createMinIOBucket() {
    const bucketName = "clickstream-storage";
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
        await minioClient.makeBucket(bucketName);
        console.log(`Bucket '${bucketName}' created`);
    }
}

async function createTable() {
    // create events table for non-scroll events
    const eventsQuery = `
    CREATE TABLE IF NOT EXISTS events (
        user_id INT,
        event_type TEXT,
        url TEXT,
        timestamp BIGINT
    );`;
    await pgClient.query(eventsQuery);

    // create scroll_events table for aggregated scroll events
    const scrollQuery = `
    CREATE TABLE IF NOT EXISTS scroll_events (
        url TEXT PRIMARY KEY,
        scroll_count INT DEFAULT 0,
        user_id INT,
        timestamp BIGINT
    );`;
    await pgClient.query(scrollQuery);

    console.log("Tables 'events' and 'scroll_events' exist");
}

async function storeEventInMinIO(event: any) {
    const objectName = `event_${event.event_type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`;
    await minioClient.putObject("clickstream-storage", objectName, JSON.stringify(event));
    console.log(`Stored event in MinIO: ${objectName}`);
}

async function run() {
    await createMinIOBucket();
    await createTable(); // ensure table exists before consuming messages
    await consumer.connect();
    await consumer.subscribe({ topic: 'clickstream', fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const end = eventProcessingDuration.startTimer();
            try {
                const event = JSON.parse(message.value!.toString());
                console.log("Processsing: ", event);

                eventsByType.inc({ event_type: event.event_type });

                await storeEventInMinIO(event);

                end();  // record processing duration
            } catch (error) {
                failedEvents.inc({ stage: 'consumer' });
                console.error('Failed to process message:', error);
            }
        }
    })
}

run();