import pkg from 'pg';
import * as Minio from 'minio';
import client from 'prom-client';

const { Client } = pkg;

const pgClient = new Client({
    user: "user",
    password: "password",
    database: "clickstream",
    host: "postgres",
});
pgClient.connect();

const minioClient = new Minio.Client({
    endPoint: "minio",
    port: 9000,
    useSSL: false,
    accessKey: "minioadmin",
    secretKey: "minioadmin",
});

const minioObjectCount = new client.Gauge({
    name: "minio_objects_count",
    help: "Number of objects in MinIO storage",
});

const processedEventsByType = new client.Counter({
    name: "processed_events_by_type_total",
    help: "Total number of events processed by type in batch",
    labelNames: ['event_type'],
});

// check table exists
async function setUpDatabase() {
    await pgClient.query(`
        CREATE TABLE IF NOT EXISTS scroll_events (
            url TEXT PRIMARY KEY,
            scroll_count INT DEFAULT 0,
            user_id INT,
            timestamp BIGINT
        )
    `);

    await pgClient.query(`
        CREATE TABLE IF NOT EXISTS events (
            user_id INT,
            event_type TEXT,
            url TEXT,
            timestamp BIGINT
        )
    `);

    console.log("Database tables set up");
}

// processes all events from MinIo
async function processScrollData() {
    return new Promise<void>((resolve, reject) => {
        const objectsStream = minioClient.listObjects("clickstream-storage", "", true);
        const scrollCounts: Record<string, { count: number, user_id: number, timestamp: number }> = {};
        const otherEvents: any[] = [];

        const promises: Promise<void>[] = [];
        let objectCount = 0;

        objectsStream.on("data", (obj) => {
            const promise = (async () => {
                try {
                    if (!obj.name) {
                        console.error("Skipping object with undefined name");
                        return;
                    }
                    console.log("Processing object: ", obj.name);
                    const dataStream = await minioClient.getObject("clickstream-storage", obj.name);

                    const event = JSON.parse(await streamToString(dataStream));
                    console.log("Event data: ", event);

                    processedEventsByType.inc({ event_type: event.event_type });

                    if (event.event_type === "scroll") {
                        // aggregate scroll events
                        if (!scrollCounts[event.url]) {
                            scrollCounts[event.url] = { count: 0, user_id: event.user_id, timestamp: event.timestamp };
                        }
                        scrollCounts[event.url].count += 1;
                        console.log("Updated scrollCounts: ", scrollCounts);
                    } else {
                        // other events for batch insertion
                        otherEvents.push(event);
                        console.log("Added to otherEvents: ", event);
                    }

                    //delete after processing
                    await minioClient.removeObject("clickstream-storage", obj.name);
                    objectCount++;
                } catch (error) {
                    console.error(`Error processing object: ${obj.name}`, error);
                }
            })();
            promises.push(promise);
        });

        objectsStream.on("end", async () => {
            await Promise.all(promises);    // ensure all "data" handlers finish

            console.log("Processed all objects");
            console.log("Scroll events to insert: ", Object.keys(scrollCounts).length);
            console.log("Other events to insert: ", otherEvents.length);

            try {
                // insert scroll events 
                for (const [url, data] of Object.entries(scrollCounts)) {
                    const query = `
                    INSERT INTO scroll_events (url, scroll_count, user_id, timestamp)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (url)
                    DO UPDATE SET scroll_count = scroll_events.scroll_count + $2
                    `;
                    const values = [url, data.count, data.user_id, data.timestamp];
                    console.log("Executing query: ", query, "with values: ", values);

                    await pgClient.query(query, values);
                }

                // batch insert other events
                if (otherEvents.length > 0) {
                    const batchSize = 100;
                    for (let i = 0; i < otherEvents.length; i += batchSize) {
                        const batch = otherEvents.slice(i, i + batchSize);

                        const values: any[] = [];
                        const placeholders: string[] = [];

                        batch.forEach((event, index) => {
                            const baseIndex = index * 4;
                            placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`);
                            values.push(event.user_id, event.event_type, event.url, event.timestamp);
                        });

                        const batchQuery = `
                            INSERT INTO events (user_id, event_type, url, timestamp)
                            VALUES ${placeholders.join(', ')}
                        `;

                        console.log(`Executing batch query for ${batch.length} events`);
                        await pgClient.query(batchQuery, values);
                    }
                }
                console.log(`Successfully processed ${objectCount} objects`);
                console.log(`Inserted ${Object.keys(scrollCounts).length} scroll event aggregations`);
                console.log(`Inserted ${otherEvents.length} other events`);
            } catch (error) {
                console.error("Error inserting into PostgreSQL:", error);
            }

            minioObjectCount.set(objectCount);
            resolve();
        });

        objectsStream.on("error", (err) => {
            console.error("Error listing objects:", err);
            reject(err);
        });
    });
}

//convert stream to string
function streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        let data = "";
        stream.on("data", (chunk: any) => (data += chunk.toString()));
        stream.on("end", () => resolve(data));
        stream.on("error", reject);
    });
}

//setup db and run processScrollData every 15 seconds
setUpDatabase().then(() => {
    setInterval(async () => {
        try {
            await processScrollData();
        } catch (error) {
            console.error('Error processing scroll data:', error);
        }
    }, 15000);
}).catch(error => {
    console.error('Failed to setup database:', error);
    process.exit(1);
})