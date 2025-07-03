# EventStream Analytics Pipeline

A real-time data pipeline that captures, processes, and analyzes events from websites. The system provides comprehensive monitoring, data visualization, and metrics collection for user behavior analytics.

## 🏗️ Architecture Overview

The pipeline consists of several containerized components:

- **Producer**: Simulates events (clicks, scrolls, purchases, views)
- **Consumer**: Processes events from Kafka and stores them in MinIO
- **Batch Processor**: Aggregates scroll events and stores processed data in PostgreSQL
- **Dashboard**: Real-time visualization of events and pipeline metrics
- **Metrics Server**: Prometheus-compatible metrics endpoint

## 🛠️ Tech Stack

- **Kafka**: Message streaming platform
- **PostgreSQL**: Primary data storage
- **MinIO**: Object storage for raw events
- **Prometheus**: Metrics collection and monitoring
- **Socket.IO**: Real-time web communication
- **Express.js**: Web server framework
- **Plotly.js**: Data visualization

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Git

### Quick Start with Docker

1. Clone the repository:
```bash
git clone https://github.com/Shivanipalya26/LogForge.git
cd LogForge
```

2. Start the entire pipeline:
```bash
docker-compose up -d
```

### Development Setup

For local development without Docker:

1. Install dependencies:
```bash
npm install
# or
pnpm install
```

2. Start infrastructure only:
```bash
docker-compose up -d kafka postgres minio
```

3. Run the application locally:
```bash
pnpm run dev
```

## 🔧 Configuration

### Docker Environment Variables

The application uses the following environment variables (configured in docker-compose.yml):

```yaml
# Database Configuration
PGUSER: user
PGPASSWORD: password
PGDATABASE: clickstream
PGHOST: postgres
PGPORT: 5432

# MinIO Configuration
MINIO_ENDPOINT: minio
MINIO_PORT: 9000
MINIO_ACCESS_KEY: minioadmin
MINIO_SECRET_KEY: minioadmin

# Kafka Configuration
KAFKA_BROKER: kafka:9092

# Application Ports
DASHBOARD_PORT: 4000
SOCKET_PORT: 4001
```
## 📈 Monitoring & Metrics

### Available Metrics

- **Pipeline Execution Count**: Number of pipeline starts
- **Event Processing Duration**: Time taken to process events
- **Events by Type**: Counter of processed events by type
- **Failed Events**: Failed processing attempts by stage
- **MinIO Object Count**: Objects waiting in storage
- **Kafka Consumer Lag**: Messages waiting to be consumed

### Prometheus Configuration

The pipeline includes Prometheus for metrics collection. The configuration scrapes metrics from the Node.js application every 15 seconds.

## 🎯 Event Types

The pipeline handles four types of events:

- **Click**: User clicks on elements
- **Scroll**: User scrolls on pages
- **Purchase**: User completes purchases
- **View**: User views pages

## 🔍 Data Processing

### Batch Processing Architecture

- Consumer stores raw Kafka events in MinIO
- Batch processor runs every 15s:
    - Scroll events → Aggregated by URL, then stored in PostgreSQL
    - Other events → Batch inserted into PostgreSQL
- Events are deleted from MinIO after successful processing

### Real-time Dashboard

- Events are broadcast via WebSocket as they arrive
- Dashboard updates instantly
- Database writes happen in batches for efficiency

### Visualizations
- **Event Distribution**: Pie chart showing event type breakdown
- **Pipeline Metrics**: Bar charts of processing statistics
- **Real-time Updates**: WebSocket-powered live updates

## 🔧 Development

### Project Structure

```
├── Dockerfile                 # Container configuration
├── docker-compose.yml         # Multi-service orchestration
├── prometheus.yml            # Prometheus configuration
├── src/
│   ├── index.ts              # Main pipeline 
│   ├── producer.ts           # Event producer
│   ├── consumer.ts           # Kafka consumer
│   ├── batchProcessor.ts     # Batch processing logic
│   ├── dashboard.ts          # Dashboard server
│   └── metrics.ts            # Metrics utilities
├── public/
│   ├── index.html            # Main dashboard UI
│   └── metrics.html          # Metrics visualization
└── package.json              # Dependencies and scripts
```

## 🐛 Troubleshooting

### Common Issues

1. **Services Not Starting**
   - Check Docker daemon is running: `docker ps`
   - View all service logs: `docker-compose logs`
   - Check individual service: `docker-compose logs <service-name>`

2. **Kafka Connection Issues**
   - Ensure Kafka is running: `docker-compose ps kafka`
   - Check Kafka logs: `docker-compose logs kafka`

3. **Database Connection Problems**
   - Check PostgreSQL logs: `docker-compose logs postgres`
   - Verify database credentials in docker-compose.yml
   - Test connection: `docker-compose exec postgres psql -U user -d clickstream`

4. **MinIO Access Errors**
   - Confirm MinIO service is running: `docker-compose ps minio`
   - Check MinIO logs: `docker-compose logs minio`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.