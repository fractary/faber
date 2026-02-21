# SPEC-20251220: Production-Grade Infrastructure Enhancements for app.fractary.com

## Metadata

| Field | Value |
|-------|-------|
| **Spec ID** | SPEC-20251220 |
| **Title** | Production-Grade Infrastructure Enhancements for app.fractary.com |
| **Status** | Draft |
| **Created** | 2025-12-20 |
| **Author** | FABER Team |
| **Related Specs** | SPEC-20251220-app-fractary-com-implementation-plan |

## 1. Executive Summary

### 1.1 Summary

This specification documents infrastructure enhancements to evolve app.fractary.com from its current MVP architecture to production-grade infrastructure comparable to Anthropic's claude.ai/code web interface. The enhancements are organized into four phases over 6 months, prioritizing performance, reliability, and cost optimization.

### 1.2 Current State (Launch Architecture)

```
User → ALB → Next.js (ECS) → Aurora Serverless v2
                ↓
         Session Container (ECS Fargate)
         └── Claude Code CLI
```

**Components**:
- Application Load Balancer (HTTPS termination)
- Next.js on ECS Fargate (API + UI)
- Aurora Serverless v2 PostgreSQL (database)
- ECS Fargate (session containers)
- Secrets Manager (credentials)
- Multi-AZ VPC

**Strengths**:
- ✅ Solid foundation for launch
- ✅ Multi-AZ resilience
- ✅ Auto-scaling database
- ✅ Secure credential management

**Gaps vs Production-Grade**:
- ❌ No caching layer (high DB load)
- ❌ No CDN (slow global load times)
- ❌ No queue system (vulnerable to traffic spikes)
- ❌ Limited observability (hard to debug)
- ❌ Expensive compute (on-demand only)
- ❌ Rate limiting in application code (not robust)

### 1.3 Target Architecture (Production-Grade)

```
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront (CDN)                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              WAF (SQL injection, XSS, DDoS)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│          API Gateway (REST + WebSocket APIs)                 │
│          - Rate limiting (per user)                          │
│          - Request validation                                │
│          - API keys                                          │
└─────────────────────────────────────────────────────────────┘
            ↓                                    ↓
    ┌──────────────┐                    ┌──────────────────┐
    │ Lambda       │                    │ Next.js (ECS)    │
    │ (WebSocket)  │                    │ (API backend)    │
    └──────────────┘                    └──────────────────┘
            ↓                                    ↓
    ┌──────────────────────────────────────────────────────┐
    │              ElastiCache (Redis)                      │
    │              - Session state                          │
    │              - Container IP cache                     │
    │              - Rate limit counters                    │
    └──────────────────────────────────────────────────────┘
            ↓
    ┌──────────────────────────────────────────────────────┐
    │              DynamoDB                                 │
    │              - Active sessions                        │
    │              - WebSocket connections                  │
    │              - Real-time status                       │
    └──────────────────────────────────────────────────────┘
            ↓
    ┌──────────────────────────────────────────────────────┐
    │              SQS Queue                                │
    │              - Session launch requests                │
    │              - Priority queuing                       │
    └──────────────────────────────────────────────────────┘
            ↓
    ┌──────────────────────────────────────────────────────┐
    │      Container Orchestrator Service (ECS)             │
    │      - Launches session containers                    │
    │      - Monitors health                                │
    └──────────────────────────────────────────────────────┘
            ↓
    ┌──────────────────────────────────────────────────────┐
    │      ECS Cluster (Fargate Spot + On-Demand)           │
    │      - Session containers                             │
    │      - Claude Code CLI                                │
    └──────────────────────────────────────────────────────┘
            ↓
    ┌──────────────────────────────────────────────────────┐
    │              RDS Proxy                                │
    │              - Connection pooling                     │
    └──────────────────────────────────────────────────────┘
            ↓
    ┌──────────────────────────────────────────────────────┐
    │      Aurora Serverless v2 (Multi-AZ)                  │
    │      - User accounts                                  │
    │      - Repository metadata                            │
    │      - Historical session data                        │
    └──────────────────────────────────────────────────────┘

        Observability Stack:
        - CloudWatch Logs + X-Ray
        - Custom metrics dashboards
        - PagerDuty alerts
```

### 1.4 Phased Rollout Timeline

- **Phase 1** (Month 1): CDN + Basic Observability
- **Phase 2** (Months 2-3): Caching + Cost Optimization
- **Phase 3** (Months 4-6): Queue System + Advanced Features
- **Phase 4** (Month 6+): API Gateway + Security Hardening

## 2. Phase-by-Phase Implementation

### Phase 1: CDN + Basic Observability (Month 1)

**Goal**: Improve global performance and visibility

#### 2.1.1 CloudFront CDN

**Problem**:
- Global users experience 200-500ms latency to ALB
- Static assets served from single region

**Solution**: CloudFront distribution in front of ALB

**Benefits**:
- 50-200ms faster initial page load globally
- Reduced ALB/backend load (static assets cached at edge)
- DDoS protection (Shield Standard included free)
- HTTPS certificate management via ACM

**Cost**: ~$0.085/GB for first 10TB + $0.01 per 10,000 requests = ~$5-15/month initially

**Implementation**:

```typescript
// CloudFormation/CDK for CloudFront
const distribution = new cloudfront.Distribution(this, 'AppDistribution', {
  defaultBehavior: {
    origin: new origins.LoadBalancerV2Origin(alb, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    }),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
  },
  additionalBehaviors: {
    '/_next/static/*': {
      origin: new origins.LoadBalancerV2Origin(alb),
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      compress: true,
    },
    '/api/*': {
      origin: new origins.LoadBalancerV2Origin(alb),
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
    },
  },
  certificate: acm.Certificate.fromCertificateArn(this, 'Cert', certArn),
  domainNames: ['app.fractary.com'],
});
```

**Cache Headers** (Next.js):
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

**Testing**:
- Verify cache hit ratio in CloudFront metrics
- Test from multiple geographic locations (US, EU, Asia)
- Monitor origin request reduction (should drop 60-80% for static assets)

#### 2.1.2 CloudWatch Dashboards

**Problem**: No centralized view of system health

**Solution**: Custom CloudWatch dashboard with key metrics

**Metrics to Track**:
```typescript
// Session Launch Latency
const sessionLaunchLatency = new cloudwatch.Metric({
  namespace: 'AppFractary',
  metricName: 'SessionLaunchLatency',
  statistic: 'Average',
  period: Duration.minutes(5),
});

// Active Sessions
const activeSessions = new cloudwatch.Metric({
  namespace: 'AppFractary',
  metricName: 'ActiveSessions',
  statistic: 'Sum',
});

// WebSocket Connections
const wsConnections = new cloudwatch.Metric({
  namespace: 'AWS/ApplicationELB',
  metricName: 'ActiveConnectionCount',
  dimensionsMap: {
    LoadBalancer: alb.loadBalancerFullName,
  },
});

// ECS Container CPU/Memory
const containerCPU = new cloudwatch.Metric({
  namespace: 'AWS/ECS',
  metricName: 'CPUUtilization',
  dimensionsMap: {
    ServiceName: service.serviceName,
    ClusterName: cluster.clusterName,
  },
});
```

**Dashboard Layout**:
```typescript
const dashboard = new cloudwatch.Dashboard(this, 'AppDashboard', {
  dashboardName: 'AppFractary-Production',
  widgets: [
    [
      new cloudwatch.GraphWidget({
        title: 'Session Launch Performance',
        left: [sessionLaunchLatency],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Active Sessions',
        left: [activeSessions],
        width: 12,
      }),
    ],
    [
      new cloudwatch.GraphWidget({
        title: 'Container CPU Utilization',
        left: [containerCPU],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Database Connections',
        left: [dbConnections],
        width: 12,
      }),
    ],
  ],
});
```

**Custom Metrics** (Application Code):
```typescript
// src/lib/metrics.ts
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

export async function recordSessionLaunchLatency(latencyMs: number) {
  await cloudwatch.send(new PutMetricDataCommand({
    Namespace: 'AppFractary',
    MetricData: [
      {
        MetricName: 'SessionLaunchLatency',
        Value: latencyMs,
        Unit: 'Milliseconds',
        Timestamp: new Date(),
      },
    ],
  }));
}

// Usage in session creation
const startTime = Date.now();
await launchSessionTaskAsync(params);
await recordSessionLaunchLatency(Date.now() - startTime);
```

**Alarms**:
```typescript
// Session launch taking too long
new cloudwatch.Alarm(this, 'SessionLaunchSlow', {
  metric: sessionLaunchLatency,
  threshold: 30000, // 30 seconds
  evaluationPeriods: 2,
  alarmDescription: 'Session launch latency exceeds 30s',
});

// High error rate
new cloudwatch.Alarm(this, 'HighErrorRate', {
  metric: apiErrors,
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'API error rate exceeds 10 errors/min',
});
```

**Cost**: Free (within CloudWatch free tier for most metrics)

---

### Phase 2: Caching + Cost Optimization (Months 2-3)

**Goal**: Improve performance and reduce costs by 50-70%

#### 2.2.1 ElastiCache (Redis) for Session State

**Problem**:
- Every WebSocket message queries Aurora for container IP
- Session status checks hit database
- Rate limiting counters in database (slow)

**Solution**: Redis cache for hot data

**Architecture**:
```
WebSocket message arrives
  ↓
Check Redis for container IP
  ↓ (cache hit - 99% of time)
Forward to container (no DB query)

  ↓ (cache miss - 1% of time)
Query Aurora
Store in Redis (TTL: 1 hour)
Forward to container
```

**Implementation**:

**Infrastructure** (CDK):
```typescript
const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
  description: 'Subnet group for Redis cache',
  subnetIds: vpc.privateSubnets.map(s => s.subnetId),
});

const securityGroup = new ec2.SecurityGroup(this, 'CacheSecurityGroup', {
  vpc,
  description: 'Security group for Redis cache',
});

// Allow inbound from ECS tasks
securityGroup.addIngressRule(
  ec2.Peer.securityGroupId(ecsSecurityGroup.securityGroupId),
  ec2.Port.tcp(6379),
  'Allow Redis access from ECS'
);

const replicationGroup = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
  replicationGroupDescription: 'App Fractary session cache',
  engine: 'redis',
  cacheNodeType: 'cache.t4g.micro', // $0.016/hour = ~$12/month
  numCacheClusters: 2, // Primary + replica for HA
  automaticFailoverEnabled: true,
  atRestEncryptionEnabled: true,
  transitEncryptionEnabled: true,
  cacheSubnetGroupName: cacheSubnetGroup.ref,
  securityGroupIds: [securityGroup.securityGroupId],
});
```

**Application Code**:
```typescript
// src/lib/cache/redis.ts
import { createClient } from 'redis';

const client = createClient({
  socket: {
    host: process.env.REDIS_ENDPOINT,
    port: 6379,
    tls: true,
  },
});

await client.connect();

export class SessionCache {
  // Cache container IP for active sessions
  async getContainerIp(sessionId: string): Promise<string | null> {
    return await client.get(`session:${sessionId}:ip`);
  }

  async setContainerIp(sessionId: string, ip: string, ttl: number = 3600) {
    await client.setEx(`session:${sessionId}:ip`, ttl, ip);
  }

  // Rate limiting
  async checkRateLimit(userId: string, limit: number = 100): Promise<boolean> {
    const key = `ratelimit:${userId}:${Math.floor(Date.now() / 60000)}`;
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, 60); // Expire in 60 seconds
    }

    return count <= limit;
  }

  // Session status (reduce DB polling)
  async getSessionStatus(sessionId: string): Promise<string | null> {
    return await client.get(`session:${sessionId}:status`);
  }

  async setSessionStatus(sessionId: string, status: string, ttl: number = 300) {
    await client.setEx(`session:${sessionId}:status`, ttl, status);
  }
}
```

**Usage in API Routes**:
```typescript
// src/app/api/sessions/[id]/ws/route.ts (WebSocket handler)
import { SessionCache } from '@/lib/cache/redis';

const cache = new SessionCache();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check rate limit (fast - Redis)
  const canProceed = await cache.checkRateLimit(userId);
  if (!canProceed) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  // Get container IP from cache (fast)
  let containerIp = await cache.getContainerIp(params.id);

  if (!containerIp) {
    // Cache miss - query database (slow)
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.id, params.id),
    });
    containerIp = session.containerIp;

    // Store in cache for next time
    if (containerIp) {
      await cache.setContainerIp(params.id, containerIp);
    }
  }

  // Forward WebSocket to container...
}
```

**Benefits**:
- Session data lookups: 50ms → <1ms (50x faster)
- Rate limiting: Database query → Redis counter (100x faster)
- Reduced Aurora load by 80-90%
- Better WebSocket performance

**Cost**:
- cache.t4g.micro (2 nodes): ~$24/month
- Data transfer: ~$5/month
- **Total**: ~$30/month

#### 2.2.2 Fargate Spot Instances

**Problem**:
- On-demand Fargate costs ~$0.04/vCPU-hour + $0.004/GB-hour
- Session containers run for extended periods
- Predictable workload (not latency-sensitive)

**Solution**: Use Fargate Spot for 70% of session containers

**Savings**:
- Fargate Spot: ~70% cheaper than on-demand
- Example: 10 concurrent sessions × 8 hours/day × 30 days
  - On-demand: ~$192/month
  - Spot (70%) + On-demand (30%): ~$77/month
  - **Savings**: ~$115/month (~60% reduction)

**Implementation** (ECS Capacity Providers):

```typescript
// CDK
const cluster = new ecs.Cluster(this, 'Cluster', {
  vpc,
  capacityProviders: ['FARGATE', 'FARGATE_SPOT'],
});

const taskDefinition = new ecs.FargateTaskDefinition(this, 'SessionTask', {
  memoryLimitMiB: 2048,
  cpu: 1024,
});

const service = new ecs.FargateService(this, 'SessionService', {
  cluster,
  taskDefinition,
  capacityProviderStrategies: [
    {
      capacityProvider: 'FARGATE_SPOT',
      weight: 70,
      base: 0,
    },
    {
      capacityProvider: 'FARGATE',
      weight: 30,
      base: 2, // Always keep 2 on-demand for guaranteed capacity
    },
  ],
});
```

**Spot Interruption Handling**:

```typescript
// Session containers should handle SIGTERM gracefully
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, saving session state...');

  // Save current work to S3
  await saveSessionState(sessionId);

  // Notify user via WebSocket
  ws.send(JSON.stringify({
    type: 'container_interruption',
    message: 'Your session is being migrated. Please wait...',
  }));

  // Update session status in DB
  await db.update(sessions)
    .set({ status: 'migrating' })
    .where(eq(sessions.id, sessionId));

  process.exit(0);
});
```

**ECS Auto-Scaling**:
```typescript
const scalableTarget = service.autoScaleTaskCount({
  minCapacity: 2,
  maxCapacity: 50,
});

// Scale based on CPU
scalableTarget.scaleOnCpuUtilization('CpuScaling', {
  targetUtilizationPercent: 70,
  scaleInCooldown: Duration.seconds(300),
  scaleOutCooldown: Duration.seconds(60),
});

// Scale based on active sessions (custom metric)
scalableTarget.scaleOnMetric('SessionScaling', {
  metric: activeSessionsMetric,
  scalingSteps: [
    { upper: 10, change: -1 },
    { lower: 20, change: +2 },
    { lower: 50, change: +5 },
  ],
});
```

**Monitoring**:
- CloudWatch metric: `AWS/ECS/SpotInterruptionCount`
- Alert if spot interruptions > 5% of tasks

**Cost**: No additional cost (savings only)

#### 2.2.3 Database Connection Pooling (RDS Proxy)

**Problem**:
- Each Next.js container maintains 5-10 DB connections
- 10 containers = 50-100 connections to Aurora
- Connection churn during deployments

**Solution**: RDS Proxy for connection pooling

**Benefits**:
- Reuse connections across containers
- Faster failover (no DNS propagation)
- Reduced DB CPU from connection overhead
- IAM authentication support

**Implementation**:

```typescript
// CDK
const dbProxy = new rds.DatabaseProxy(this, 'AuroraProxy', {
  proxyTarget: rds.ProxyTarget.fromCluster(auroraCluster),
  secrets: [auroraCluster.secret!],
  vpc,
  requireTLS: true,
  maxConnectionsPercent: 50,
  maxIdleConnectionsPercent: 25,
  connectionBorrowTimeout: Duration.seconds(30),
});

// Grant access to ECS task role
dbProxy.grantConnect(ecsTaskRole);
```

**Application Code**:
```typescript
// Update DATABASE_URL to point to RDS Proxy endpoint
// .env.production
DATABASE_URL=postgresql://user:password@proxy-endpoint.region.rds.amazonaws.com:5432/fractary

// Drizzle connection with pooling
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_PROXY_ENDPOINT,
  port: 5432,
  database: 'fractary',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: true },
  max: 5, // Max connections per container (RDS Proxy will pool)
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool);
```

**Cost**:
- RDS Proxy: $0.015/hour per vCPU = ~$22/month (2 vCPU proxy)
- Reduced Aurora CPU usage: -$10-15/month
- **Net cost**: ~$7-12/month

**Total Phase 2 Costs**:
- ElastiCache: +$30/month
- Fargate Spot savings: -$115/month
- RDS Proxy: +$10/month
- **Net savings**: ~$75/month

---

### Phase 3: Queue System + Advanced Features (Months 4-6)

**Goal**: Handle traffic spikes and improve reliability

#### 2.3.1 SQS Queue for Session Launch

**Problem**:
- Synchronous session launches block API response
- Traffic spikes can overwhelm ECS capacity
- No priority system (Enterprise users wait same as Free users)

**Solution**: Queue-based session launch with priority

**Architecture**:
```
POST /api/sessions
  ↓
Write session record (status: pending)
  ↓
Send to SQS queue (priority based on user tier)
  ↓
Return 202 Accepted to user
  ↓
Lambda worker picks up from queue
  ↓
Launch ECS container
  ↓
Update session status (starting → running)
  ↓
User polls GET /api/sessions/{id} for status
```

**Implementation**:

**Infrastructure** (SQS Queues):
```typescript
// High priority queue (Enterprise users)
const highPriorityQueue = new sqs.Queue(this, 'SessionLaunchHighPriority', {
  queueName: 'session-launch-high-priority',
  visibilityTimeout: Duration.minutes(5),
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3,
  },
});

// Standard priority queue (Free/Pro users)
const standardQueue = new sqs.Queue(this, 'SessionLaunchStandard', {
  queueName: 'session-launch-standard',
  visibilityTimeout: Duration.minutes(5),
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3,
  },
});

// Dead letter queue for failed launches
const dlq = new sqs.Queue(this, 'SessionLaunchDLQ', {
  queueName: 'session-launch-dlq',
  retentionPeriod: Duration.days(14),
});
```

**API Route Changes**:
```typescript
// src/app/api/sessions/route.ts
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqs = new SQSClient({ region: process.env.AWS_REGION });

export async function POST(request: NextRequest) {
  // ... authentication and validation ...

  // Create session record (status: pending)
  const [newSession] = await db.insert(sessions).values({
    userId: user.id,
    repoId: repo.id,
    branch: validatedData.branch,
    status: 'pending',
  }).returning();

  // Determine queue based on user tier
  const queueUrl = user.tier === 'enterprise'
    ? process.env.SQS_HIGH_PRIORITY_QUEUE_URL
    : process.env.SQS_STANDARD_QUEUE_URL;

  // Send to queue
  await sqs.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify({
      sessionId: newSession.id,
      userId: user.id,
      repoUrl: repo.cloneUrl,
      branch: validatedData.branch,
      mode: validatedData.mode || 'terminal',
      workId: validatedData.workId,
    }),
    MessageAttributes: {
      userId: { DataType: 'String', StringValue: user.id },
      sessionId: { DataType: 'String', StringValue: newSession.id },
    },
  }));

  // Return 202 Accepted (session is queued)
  return NextResponse.json(
    {
      session: newSession,
      message: 'Session queued for launch. Poll GET /api/sessions/{id} for status.',
    },
    { status: 202 }
  );
}
```

**Lambda Worker** (processes queue):
```typescript
// lambda/session-launcher/index.ts
import { SQSHandler } from 'aws-lambda';
import { launchSessionTaskAsync } from './ecs-client';
import { updateSessionStatus } from './database';

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    const { sessionId, userId, repoUrl, branch, mode, workId } = message;

    try {
      // Update status to starting
      await updateSessionStatus(sessionId, 'starting');

      // Launch ECS container
      const result = await launchSessionTaskAsync({
        sessionId,
        repoUrl,
        branch,
        userId,
        mode,
        workId,
      });

      // Update session with task ARN
      await db.update(sessions)
        .set({
          taskArn: result.taskArn,
          status: 'starting',
          lastActivityAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Start background polling for container readiness
      await startPolling(sessionId);

    } catch (error) {
      console.error(`Failed to launch session ${sessionId}:`, error);

      // Update status to failed
      await updateSessionStatus(sessionId, 'failed');

      // Send to DLQ (automatic by SQS after maxReceiveCount)
      throw error;
    }
  }
};
```

**Lambda Configuration**:
```typescript
const launcher = new lambda.Function(this, 'SessionLauncher', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/session-launcher'),
  timeout: Duration.minutes(5),
  memorySize: 512,
  environment: {
    ECS_CLUSTER_ARN: cluster.clusterArn,
    ECS_TASK_DEFINITION_ARN: taskDefinition.taskDefinitionArn,
    // ... other env vars
  },
  reservedConcurrentExecutions: 10, // Max 10 concurrent launches
});

// Trigger from both queues (high priority processed first)
launcher.addEventSource(new SqsEventSource(highPriorityQueue, {
  batchSize: 1,
  maxConcurrency: 5, // Process 5 high-priority at once
}));

launcher.addEventSource(new SqsEventSource(standardQueue, {
  batchSize: 1,
  maxConcurrency: 5, // Process 5 standard at once
}));
```

**Benefits**:
- API responds in <100ms (vs 30+ seconds synchronous)
- Queue absorbs traffic spikes (10,000+ queued sessions OK)
- Priority system for paying customers
- Automatic retry with exponential backoff
- Better error handling (DLQ for investigation)

**Cost**:
- SQS: $0.40 per million requests ≈ $2-5/month
- Lambda: $0.20 per million requests + compute ≈ $10-20/month
- **Total**: ~$15-25/month

#### 2.3.2 DynamoDB for Active Session State

**Problem**:
- Aurora not optimized for high-write workloads
- Session status updates are frequent (every 5 seconds during polling)
- WebSocket connection state tracking

**Solution**: DynamoDB for active sessions, Aurora for historical data

**Data Model**:

**DynamoDB Table** (active sessions):
```typescript
// sessions-active table
{
  sessionId: 'abc-123',              // Partition key
  userId: 'user-456',
  status: 'running',                 // pending, starting, running, stopped
  containerIp: '10.0.1.25',
  taskArn: 'arn:aws:ecs:...',
  lastActivityAt: 1703001234,        // Unix timestamp
  mode: 'chat',
  workId: '123',
  ttl: 1703087634,                   // Auto-delete after 24 hours of inactivity
}

// websocket-connections table
{
  connectionId: 'abc123',            // Partition key (API Gateway connection ID)
  sessionId: 'abc-123',              // GSI partition key
  userId: 'user-456',
  connectedAt: 1703001234,
  ttl: 1703087634,                   // Auto-delete after disconnect
}
```

**Infrastructure**:
```typescript
const activeSessionsTable = new dynamodb.Table(this, 'ActiveSessions', {
  tableName: 'sessions-active',
  partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
  pointInTimeRecovery: true,
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
});

// GSI for querying by userId
activeSessionsTable.addGlobalSecondaryIndex({
  indexName: 'userId-index',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

const connectionsTable = new dynamodb.Table(this, 'WebSocketConnections', {
  tableName: 'websocket-connections',
  partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
});

connectionsTable.addGlobalSecondaryIndex({
  indexName: 'sessionId-index',
  partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
});
```

**Application Code**:
```typescript
// src/lib/sessions/state.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export class SessionState {
  async createSession(session: {
    sessionId: string;
    userId: string;
    mode: string;
    workId?: string;
  }) {
    // Write to DynamoDB (active state)
    await dynamodb.send(new PutCommand({
      TableName: 'sessions-active',
      Item: {
        sessionId: session.sessionId,
        userId: session.userId,
        status: 'pending',
        mode: session.mode,
        workId: session.workId,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      },
    }));

    // Also write to Aurora (historical record)
    await db.insert(sessions).values({
      id: session.sessionId,
      userId: session.userId,
      // ... other fields
    });
  }

  async updateSessionStatus(sessionId: string, status: string, containerIp?: string) {
    // Update DynamoDB (fast)
    await dynamodb.send(new UpdateCommand({
      TableName: 'sessions-active',
      Key: { sessionId },
      UpdateExpression: 'SET #status = :status, lastActivityAt = :now, containerIp = :ip',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':now': Date.now(),
        ':ip': containerIp || null,
      },
    }));

    // Also update Aurora (slower, but canonical source)
    await db.update(sessions)
      .set({ status, containerIp, lastActivityAt: new Date() })
      .where(eq(sessions.id, sessionId));
  }

  async getActiveSession(sessionId: string) {
    const result = await dynamodb.send(new GetCommand({
      TableName: 'sessions-active',
      Key: { sessionId },
    }));

    return result.Item;
  }

  async getUserActiveSessions(userId: string) {
    const result = await dynamodb.send(new QueryCommand({
      TableName: 'sessions-active',
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#status IN (:running, :starting)',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':running': 'running',
        ':starting': 'starting',
      },
    }));

    return result.Items || [];
  }
}
```

**DynamoDB Streams** (sync to Aurora for historical data):
```typescript
const syncFunction = new lambda.Function(this, 'DynamoSyncFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/dynamo-sync'),
});

syncFunction.addEventSource(new DynamoEventSource(activeSessionsTable, {
  startingPosition: lambda.StartingPosition.TRIM_HORIZON,
  batchSize: 10,
  retryAttempts: 3,
}));

// lambda/dynamo-sync/index.ts
export const handler = async (event: DynamoDBStreamEvent) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
      const session = record.dynamodb?.NewImage;

      // Sync to Aurora for historical tracking
      await db.update(sessions)
        .set({
          status: session.status.S,
          containerIp: session.containerIp?.S,
          lastActivityAt: new Date(Number(session.lastActivityAt.N)),
        })
        .where(eq(sessions.id, session.sessionId.S));
    }
  }
};
```

**Benefits**:
- Session status reads: <1ms (vs 10-50ms from Aurora)
- Supports 1000s of writes/second (vs Aurora limit of ~100-200/sec)
- Auto-cleanup with TTL (no manual cleanup jobs)
- Better for WebSocket connection tracking

**Cost**:
- DynamoDB on-demand: $1.25 per million writes, $0.25 per million reads
- Estimate: 10,000 sessions/day × 100 updates each = 1M writes/day = $37/month
- DynamoDB cheaper than scaling Aurora for write-heavy workload

#### 2.3.3 X-Ray Distributed Tracing

**Problem**: Hard to debug issues spanning multiple services

**Solution**: AWS X-Ray for end-to-end tracing

**Implementation**:
```typescript
// Enable X-Ray on Lambda
const launcher = new lambda.Function(this, 'SessionLauncher', {
  tracing: lambda.Tracing.ACTIVE,
  // ... other config
});

// Enable X-Ray on API Gateway
const api = new apigateway.RestApi(this, 'Api', {
  deployOptions: {
    tracingEnabled: true,
  },
});

// Application code (Next.js)
import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

const xrayAWS = AWSXRay.captureAWS(AWS);

// Trace segments
const segment = AWSXRay.getSegment();
const subsegment = segment.addNewSubsegment('session-launch');

try {
  await launchSessionTaskAsync(params);
  subsegment.close();
} catch (error) {
  subsegment.addError(error);
  subsegment.close();
  throw error;
}
```

**Benefits**:
- See full request path: User → API → SQS → Lambda → ECS
- Identify slow operations (e.g., "ECS RunTask takes 25s")
- Correlate errors across services

**Cost**: $5 per 1 million traces recorded + $0.50 per 1 million traces retrieved ≈ $10-20/month

**Total Phase 3 Costs**:
- SQS + Lambda: +$25/month
- DynamoDB: +$37/month
- X-Ray: +$15/month
- **Total**: +$77/month

---

### Phase 4: API Gateway + Security Hardening (Month 6+)

**Goal**: Production-grade security and rate limiting

#### 2.4.1 API Gateway (REST + WebSocket)

**Problem**:
- Rate limiting in application code (not robust)
- No API versioning
- WebSocket connections directly to ALB (limited features)

**Solution**: API Gateway for REST and WebSocket APIs

**REST API**:
```typescript
const api = new apigateway.RestApi(this, 'AppApi', {
  restApiName: 'fractary-app-api',
  description: 'App Fractary REST API',
  deployOptions: {
    stageName: 'prod',
    tracingEnabled: true,
    loggingLevel: apigateway.MethodLoggingLevel.INFO,
  },
  defaultCorsPreflightOptions: {
    allowOrigins: ['https://app.fractary.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Usage plan for rate limiting
const plan = api.addUsagePlan('UsagePlan', {
  name: 'Standard',
  throttle: {
    rateLimit: 100,      // 100 requests per second
    burstLimit: 200,     // Burst up to 200
  },
  quota: {
    limit: 100000,       // 100k requests per month
    period: apigateway.Period.MONTH,
  },
});

// API key for authenticated requests
const key = api.addApiKey('ApiKey', {
  apiKeyName: 'app-key',
});

plan.addApiKey(key);

// Routes
const sessions = api.root.addResource('sessions');
sessions.addMethod('POST', new apigateway.LambdaIntegration(createSessionFunction));
sessions.addMethod('GET', new apigateway.LambdaIntegration(listSessionsFunction));

const session = sessions.addResource('{id}');
session.addMethod('GET', new apigateway.LambdaIntegration(getSessionFunction));
session.addMethod('DELETE', new apigateway.LambdaIntegration(deleteSessionFunction));
```

**WebSocket API**:
```typescript
const wsApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
  apiName: 'fractary-websocket',
  routeSelectionExpression: '$request.body.action',
  connectRouteOptions: {
    integration: new WebSocketLambdaIntegration('ConnectIntegration', connectFunction),
  },
  disconnectRouteOptions: {
    integration: new WebSocketLambdaIntegration('DisconnectIntegration', disconnectFunction),
  },
  defaultRouteOptions: {
    integration: new WebSocketLambdaIntegration('DefaultIntegration', messageFunction),
  },
});

const stage = new apigatewayv2.WebSocketStage(this, 'ProdStage', {
  webSocketApi: wsApi,
  stageName: 'prod',
  autoDeploy: true,
});
```

**WebSocket Lambda Handlers**:

```typescript
// lambda/websocket/connect.ts
export const handler = async (event: APIGatewayProxyWebSocketEvent) => {
  const connectionId = event.requestContext.connectionId;
  const sessionId = event.queryStringParameters?.sessionId;

  // Store connection in DynamoDB
  await dynamodb.send(new PutCommand({
    TableName: 'websocket-connections',
    Item: {
      connectionId,
      sessionId,
      connectedAt: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 7200, // 2 hours
    },
  }));

  return { statusCode: 200, body: 'Connected' };
};

// lambda/websocket/message.ts
export const handler = async (event: APIGatewayProxyWebSocketEvent) => {
  const connectionId = event.requestContext.connectionId;
  const message = JSON.parse(event.body || '{}');

  // Get session from connection
  const connection = await dynamodb.send(new GetCommand({
    TableName: 'websocket-connections',
    Key: { connectionId },
  }));

  if (!connection.Item) {
    return { statusCode: 404, body: 'Connection not found' };
  }

  const sessionId = connection.Item.sessionId;

  // Get container IP from cache/DynamoDB
  const session = await cache.getContainerIp(sessionId);

  // Forward message to container via HTTP
  await axios.post(`http://${session}:3000/message`, message);

  return { statusCode: 200, body: 'Sent' };
};

// lambda/websocket/disconnect.ts
export const handler = async (event: APIGatewayProxyWebSocketEvent) => {
  const connectionId = event.requestContext.connectionId;

  // Remove from DynamoDB
  await dynamodb.send(new DeleteCommand({
    TableName: 'websocket-connections',
    Key: { connectionId },
  }));

  return { statusCode: 200, body: 'Disconnected' };
};
```

**Benefits**:
- Built-in rate limiting (no application code)
- API versioning support
- Better WebSocket connection management
- Request validation before reaching backend
- CloudWatch metrics out of the box

**Cost**:
- REST API: $3.50 per million requests + $0.09/GB data transfer
- WebSocket API: $1.00 per million messages + $0.25 per million connection minutes
- Estimate: $25-50/month depending on usage

#### 2.4.2 WAF (Web Application Firewall)

**Problem**: No protection against common attacks

**Solution**: AWS WAF with managed rule sets

**Implementation**:
```typescript
const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
  scope: 'REGIONAL',
  defaultAction: { allow: {} },
  rules: [
    // AWS Managed Rules - Core Rule Set
    {
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 1,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesCommonRuleSetMetric',
      },
    },
    // SQL Injection protection
    {
      name: 'AWSManagedRulesSQLiRuleSet',
      priority: 2,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesSQLiRuleSet',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesSQLiRuleSetMetric',
      },
    },
    // Rate-based rule (DDoS protection)
    {
      name: 'RateLimitRule',
      priority: 3,
      action: { block: {} },
      statement: {
        rateBasedStatement: {
          limit: 2000, // 2000 requests per 5 minutes from single IP
          aggregateKeyType: 'IP',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitRuleMetric',
      },
    },
    // Block known bad IPs (reputation list)
    {
      name: 'AWSManagedRulesAmazonIpReputationList',
      priority: 4,
      overrideAction: { none: {} },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesAmazonIpReputationList',
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesAmazonIpReputationListMetric',
      },
    },
  ],
  visibilityConfig: {
    sampledRequestsEnabled: true,
    cloudWatchMetricsEnabled: true,
    metricName: 'WebAclMetric',
  },
});

// Associate with API Gateway
new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
  resourceArn: api.deploymentStage.stageArn,
  webAclArn: webAcl.attrArn,
});
```

**Benefits**:
- Protection against OWASP Top 10 vulnerabilities
- SQL injection blocking
- XSS attack prevention
- Rate-based DDoS protection
- IP reputation filtering

**Cost**:
- $5/month base + $1/month per rule + $0.60 per million requests
- Estimate: $10-15/month

#### 2.4.3 Secrets Rotation

**Problem**: Static secrets (API keys, GitHub tokens) never rotated

**Solution**: Automated secrets rotation with Lambda

**Implementation**:
```typescript
const rotationFunction = new lambda.Function(this, 'SecretsRotation', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/secrets-rotation'),
  timeout: Duration.minutes(5),
});

// Rotate Anthropic API keys every 90 days
const rotationSchedule = new events.Rule(this, 'RotationSchedule', {
  schedule: events.Schedule.rate(Duration.days(90)),
});

rotationSchedule.addTarget(new targets.LambdaFunction(rotationFunction));

// Lambda handler
export const handler = async () => {
  // Get all user secrets
  const users = await db.select().from(users);

  for (const user of users) {
    try {
      // Notify user to update API key
      await sendEmail({
        to: user.email,
        subject: 'Action Required: Rotate your Anthropic API key',
        body: 'Your API key will expire in 7 days. Please update it in Settings.',
      });

      // Mark secret for rotation
      await secretsManager.send(new RotateSecretCommand({
        SecretId: getUserApiKeySecretName(user.id),
        RotationLambdaARN: rotationFunction.functionArn,
      }));
    } catch (error) {
      console.error(`Failed to rotate secret for user ${user.id}:`, error);
    }
  }
};
```

**Cost**: Negligible (Lambda runs quarterly)

**Total Phase 4 Costs**:
- API Gateway: +$40/month
- WAF: +$15/month
- Secrets rotation: +$1/month
- **Total**: +$56/month

---

## 3. Complete Cost Analysis

### Current Architecture (Launch)
- ECS Fargate (on-demand): ~$200/month
- Aurora Serverless v2: ~$100/month
- ALB: ~$25/month
- Data transfer: ~$20/month
- **Total**: ~$345/month

### After All Phases (Production-Grade)
**Infrastructure**:
- CloudFront: +$10/month
- ElastiCache: +$30/month
- Fargate Spot savings: -$115/month
- RDS Proxy: +$10/month
- SQS + Lambda: +$25/month
- DynamoDB: +$37/month
- X-Ray: +$15/month
- API Gateway: +$40/month
- WAF: +$15/month

**Savings**:
- Fargate Spot: -$115/month
- Reduced Aurora load from caching: -$20/month

**Net Change**: +$47/month

**Total**: ~$392/month (~14% increase)

### ROI Justification

**For +$47/month, you get**:
- 50x faster session lookups (<1ms vs 50ms)
- 70% cost savings on compute (Fargate Spot)
- Built-in DDoS protection (WAF)
- 10x better rate limiting (API Gateway)
- Global CDN (CloudFront)
- Queue-based resilience (handle 10,000+ spike)
- Production observability (X-Ray, metrics)
- Security hardening (WAF, secrets rotation)

## 4. Rollback Plans

### Phase 1 Rollback (CloudFront)
- Update DNS to point directly to ALB
- Delete CloudFront distribution
- No data migration needed

### Phase 2 Rollback (Caching)
**ElastiCache**:
- Remove Redis calls from application code
- Deploy without cache dependency
- Delete ElastiCache cluster

**Fargate Spot**:
- Update capacity provider weights to 100% on-demand
- No data loss (spot → on-demand migration)

### Phase 3 Rollback (Queue + DynamoDB)
**SQS Queue**:
- Revert API routes to synchronous launch
- Disable Lambda workers
- Delete SQS queues after drain

**DynamoDB**:
- Switch session state reads back to Aurora
- Stop DynamoDB writes
- Keep Aurora as source of truth

### Phase 4 Rollback (API Gateway)
- Point CloudFront back to ALB (bypass API Gateway)
- No data migration needed
- Keep WAF attached to ALB if desired

## 5. Testing Strategy

### Phase 1 Testing
- Load test with CloudFront enabled vs disabled
- Verify cache hit ratio >60% for static assets
- Test from multiple geographic regions
- Validate CloudWatch dashboards show accurate data

### Phase 2 Testing
- Load test session creation with Redis enabled
- Verify Fargate Spot interruption handling
- Test RDS Proxy connection pooling under load
- Benchmark: Session lookup latency should be <5ms

### Phase 3 Testing
- Queue 100 concurrent session launches (verify queue handling)
- Test priority queuing (Enterprise launches first)
- Verify DynamoDB TTL cleanup works
- Test DynamoDB → Aurora sync via Streams

### Phase 4 Testing
- Penetration testing with WAF enabled
- Load test API Gateway rate limiting
- Test WebSocket API scalability (1000+ concurrent connections)
- Verify WAF blocks known attack patterns (SQL injection, XSS)

## 6. Success Metrics

### Performance Metrics
- **Session launch latency**: <30 seconds (p95)
- **API response time**: <200ms (p95)
- **WebSocket message latency**: <100ms (p95)
- **Session status lookup**: <5ms (p95)
- **Cache hit ratio**: >80%

### Reliability Metrics
- **API availability**: >99.9% uptime
- **Session launch success rate**: >99%
- **Spot interruption rate**: <5%
- **Failed deployment rate**: <1%

### Cost Metrics
- **Cost per session**: <$0.50/hour
- **Infrastructure cost per active user**: <$10/month
- **Fargate Spot adoption**: >60% of containers

### Security Metrics
- **WAF block rate**: <0.1% legitimate traffic blocked
- **Secrets rotation compliance**: 100% rotated within 90 days
- **Zero critical security vulnerabilities**: Pass quarterly pen tests

## 7. Maintenance Runbook

### Weekly Tasks
- Review CloudWatch dashboards for anomalies
- Check DLQ for failed session launches
- Verify cache hit ratios are healthy (>70%)

### Monthly Tasks
- Review cost breakdown in Cost Explorer
- Audit Fargate Spot interruption rate
- Review WAF blocked requests (tune rules if needed)
- Test backup/restore procedures

### Quarterly Tasks
- Conduct penetration testing
- Review and rotate IAM credentials
- Update Lambda runtime versions
- Review DynamoDB table cleanup (TTL working correctly)

### Annual Tasks
- Major version upgrades (Aurora, ElastiCache, ECS)
- Architecture review (is multi-region needed?)
- Disaster recovery drill
- Security audit and compliance review

## 8. References

### AWS Documentation
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)
- [API Gateway WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [WAF Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups.html)

### Related Specs
- SPEC-20251220-app-fractary-com-implementation-plan
- SPEC-20251220-app-fractary-com-faber-integration
- SPEC-20251219-claude-code-orchestration-architecture

## 9. Appendix

### A. Alternative Architectures Considered

**EKS Instead of ECS**:
- **Pros**: More portable, richer ecosystem, better resource packing
- **Cons**: Higher operational overhead, more complex, slower to implement
- **Decision**: Stick with ECS for now, migrate to EKS if multi-cloud needed

**Aurora Global Database**:
- **Pros**: Cross-region replication, disaster recovery
- **Cons**: Higher cost, added complexity
- **Decision**: Defer until multi-region is needed

**EventBridge Instead of SQS**:
- **Pros**: Built-in routing, multiple targets
- **Cons**: More expensive, unnecessary complexity for simple queue
- **Decision**: SQS is sufficient for session launch queue

### B. Estimated Timeline

| Phase | Duration | Parallel Work Possible? |
|-------|----------|-------------------------|
| Phase 1 | 1 week | No (sequential) |
| Phase 2 | 2-3 weeks | Yes (Redis + Spot + Proxy in parallel) |
| Phase 3 | 3-4 weeks | Yes (SQS + DynamoDB + X-Ray in parallel) |
| Phase 4 | 2-3 weeks | Yes (API Gateway + WAF in parallel) |
| **Total** | **8-11 weeks** | With 2-3 engineers |

### C. Team Requirements

**Skills Needed**:
- AWS infrastructure (CDK/CloudFormation)
- Node.js/TypeScript (Lambda functions)
- Database optimization (DynamoDB, Aurora, Redis)
- DevOps (CI/CD, monitoring, alerting)

**Recommended Team**:
- 1 Senior DevOps Engineer (infrastructure)
- 1 Backend Engineer (application changes)
- 1 Part-time DBA (database optimization)

### D. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| CloudFront cache poisoning | Medium | Use signed URLs for sensitive data |
| Fargate Spot interruptions | Low | 30% on-demand buffer, graceful shutdown |
| DynamoDB costs exceed budget | Medium | Set CloudWatch alarm on WCU/RCU, use on-demand billing |
| WAF blocks legitimate traffic | High | Start in count mode, tune rules over 2 weeks |
| API Gateway limits hit | Medium | Request limit increase from AWS support |
| Migration downtime | High | Blue/green deployment, rollback plan ready |
