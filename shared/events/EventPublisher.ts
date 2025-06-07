import Redis from 'ioredis';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { DomainEvent, EventHandler, EventSubscriber } from '../types/events';
import { logger } from '../utils/logger';
import { config } from '../config/config';

// Event Publisher interface for different implementations
export interface IEventPublisher {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): Promise<void>;
  unsubscribe(eventType: string): Promise<void>;
}

// Redis implementation for development/simple deployments
export class RedisEventPublisher implements IEventPublisher {
  private redis: Redis;
  private subscribers: Map<string, EventHandler[]> = new Map();
  private consumerRunning = false;

  constructor(redisConfig: { url: string; streamName: string }) {
    this.redis = new Redis(redisConfig.url);
  }

  async connect(): Promise<void> {
    try {
      await this.redis.ping();
      logger.info('Redis event publisher connected');
      
      // Start consumer if not already running
      if (!this.consumerRunning) {
        this.startConsumer();
      }
    } catch (error) {
      logger.error('Failed to connect Redis event publisher', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.consumerRunning = false;
    await this.redis.disconnect();
    logger.info('Redis event publisher disconnected');
  }

  async publish(event: DomainEvent): Promise<void> {
    try {
      await this.redis.xadd(
        config.eventBus.redis.streamName,
        '*',
        'id', event.id,
        'type', event.type,
        'aggregateId', event.aggregateId,
        'data', JSON.stringify(event.data),
        'timestamp', event.timestamp.toISOString(),
        'metadata', JSON.stringify(event.metadata || {})
      );

      logger.info('Event published to Redis', {
        eventId: event.id,
        eventType: event.type,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      logger.error('Failed to publish event to Redis', error as Error, {
        eventId: event.id,
        eventType: event.type,
      });
      throw error;
    }
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    
    this.subscribers.get(eventType)!.push(handler);
    logger.info('Subscribed to event type', { eventType });
  }

  async unsubscribe(eventType: string): Promise<void> {
    this.subscribers.delete(eventType);
    logger.info('Unsubscribed from event type', { eventType });
  }

  private startConsumer(): void {
    this.consumerRunning = true;
    
    // Start reading from the stream
    this.consumeMessages();
  }

  private async consumeMessages(): Promise<void> {
    while (this.consumerRunning) {
      try {
        const messages = await this.redis.xread(
          'BLOCK', 1000,
          'STREAMS', config.eventBus.redis.streamName, '$'
        );

        if (messages && messages.length > 0) {
          for (const stream of messages) {
            const [streamName, entries] = stream;
            
            for (const entry of entries) {
              await this.processMessage(entry);
            }
          }
        }
      } catch (error) {
        logger.error('Error consuming Redis stream messages', error as Error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
      }
    }
  }

  private async processMessage(entry: any): Promise<void> {
    try {
      const [messageId, fields] = entry;
      const fieldMap = this.fieldsToMap(fields);
      
      const event: DomainEvent = {
        id: fieldMap.id,
        type: fieldMap.type,
        aggregateId: fieldMap.aggregateId,
        data: JSON.parse(fieldMap.data),
        timestamp: new Date(fieldMap.timestamp),
        metadata: JSON.parse(fieldMap.metadata || '{}'),
      };

      const handlers = this.subscribers.get(event.type) || [];
      
      // Execute all handlers for this event type
      await Promise.all(
        handlers.map(async (handler) => {
          try {
            await handler(event);
          } catch (error) {
            logger.error('Event handler failed', error as Error, {
              eventId: event.id,
              eventType: event.type,
              handlerName: handler.name,
            });
          }
        })
      );
    } catch (error) {
      logger.error('Failed to process Redis stream message', error as Error);
    }
  }

  private fieldsToMap(fields: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i]] = fields[i + 1];
    }
    return map;
  }
}

// Kafka implementation for production
export class KafkaEventPublisher implements IEventPublisher {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private subscribers: Map<string, EventHandler[]> = new Map();

  constructor(kafkaConfig: { brokers: string[]; clientId: string; groupId: string }) {
    this.kafka = new Kafka({
      clientId: kafkaConfig.clientId,
      brokers: kafkaConfig.brokers,
    });
    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Kafka event publisher connected');
    } catch (error) {
      logger.error('Failed to connect Kafka event publisher', error as Error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    
    // Disconnect all consumers
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
    
    logger.info('Kafka event publisher disconnected');
  }

  async publish(event: DomainEvent): Promise<void> {
    try {
      await this.producer.send({
        topic: 'domain-events',
        messages: [{
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            eventType: event.type,
            eventId: event.id,
            timestamp: event.timestamp.toISOString(),
          },
        }],
      });

      logger.info('Event published to Kafka', {
        eventId: event.id,
        eventType: event.type,
        aggregateId: event.aggregateId,
      });
    } catch (error) {
      logger.error('Failed to publish event to Kafka', error as Error, {
        eventId: event.id,
        eventType: event.type,
      });
      throw error;
    }
  }

  async subscribe(eventType: string, handler: EventHandler): Promise<void> {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
      
      // Create a new consumer for this event type
      const consumer = this.kafka.consumer({ 
        groupId: `${config.eventBus.kafka.groupId}-${eventType}` 
      });
      
      await consumer.connect();
      await consumer.subscribe({ topic: 'domain-events' });
      
      await consumer.run({
        eachMessage: async ({ message }) => {
          try {
            const event = JSON.parse(message.value!.toString()) as DomainEvent;
            
            if (event.type === eventType) {
              const handlers = this.subscribers.get(eventType) || [];
              
              await Promise.all(
                handlers.map(async (h) => {
                  try {
                    await h(event);
                  } catch (error) {
                    logger.error('Kafka event handler failed', error as Error, {
                      eventId: event.id,
                      eventType: event.type,
                    });
                  }
                })
              );
            }
          } catch (error) {
            logger.error('Failed to process Kafka message', error as Error);
          }
        },
      });
      
      this.consumers.set(eventType, consumer);
    }
    
    this.subscribers.get(eventType)!.push(handler);
    logger.info('Subscribed to Kafka event type', { eventType });
  }

  async unsubscribe(eventType: string): Promise<void> {
    const consumer = this.consumers.get(eventType);
    if (consumer) {
      await consumer.disconnect();
      this.consumers.delete(eventType);
    }
    
    this.subscribers.delete(eventType);
    logger.info('Unsubscribed from Kafka event type', { eventType });
  }
}

// Factory function to create the appropriate event publisher
export const createEventPublisher = (): IEventPublisher => {
  switch (config.eventBus.type) {
    case 'kafka':
      return new KafkaEventPublisher(config.eventBus.kafka);
    case 'redis':
    default:
      return new RedisEventPublisher(config.eventBus.redis);
  }
};

// Event aggregator for batch publishing
export class EventAggregator {
  private events: DomainEvent[] = [];
  private publisher: IEventPublisher;
  private batchSize: number;
  private flushInterval: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    publisher: IEventPublisher,
    options: { batchSize?: number; flushInterval?: number } = {}
  ) {
    this.publisher = publisher;
    this.batchSize = options.batchSize || 10;
    this.flushInterval = options.flushInterval || 5000; // 5 seconds
    
    this.startTimer();
  }

  async addEvent(event: DomainEvent): Promise<void> {
    this.events.push(event);
    
    if (this.events.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.events.length === 0) return;
    
    const eventsToPublish = [...this.events];
    this.events = [];
    
    await Promise.all(
      eventsToPublish.map(event => this.publisher.publish(event))
    );
    
    logger.info('Flushed event batch', { count: eventsToPublish.length });
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      this.flush().catch(error => {
        logger.error('Failed to flush events on timer', error as Error);
      });
    }, this.flushInterval);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    
    await this.flush();
  }
}
