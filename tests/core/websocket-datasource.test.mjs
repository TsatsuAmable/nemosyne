/**
 * Unit tests for WebSocketDataSource
 * Uses mock WebSocket for testing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocketDataSource, loadWebSocket } from '../../src/core/WebSocketDataSource.js';

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    
    // Simulate async connection
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  send(data) {
    this.lastSent = data;
  }
  
  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }
  
  // Helper to simulate receiving message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data });
    }
  }
  
  // Helper to simulate error
  simulateError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
};

describe('WebSocketDataSource', () => {
  let wsSource;
  
  beforeEach(() => {
    wsSource = new WebSocketDataSource('ws://test.example.com/data');
  });
  
  afterEach(() => {
    if (wsSource) {
      wsSource.disconnect();
    }
  });
  
  describe('Connection', () => {
    it('should connect to WebSocket server', async () => {
      const connectPromise = wsSource.connect();
      await expect(connectPromise).resolves.toBeUndefined();
      expect(wsSource.connected).toBe(true);
    });
    
    it('should emit connect event', async () => {
      const connectHandler = jest.fn();
      wsSource.on('connect', connectHandler);
      
      await wsSource.connect();
      
      expect(connectHandler).toHaveBeenCalled();
    });
    
    it('should disconnect from server', async () => {
      await wsSource.connect();
      expect(wsSource.connected).toBe(true);
      
      wsSource.disconnect();
      expect(wsSource.connected).toBe(false);
    });
    
    it('should emit disconnect event', async () => {
      const disconnectHandler = jest.fn();
      wsSource.on('disconnect', disconnectHandler);
      
      await wsSource.connect();
      wsSource.disconnect();
      
      // Wait for async close
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(disconnectHandler).toHaveBeenCalled();
    });
  });
  
  describe('Message Handling', () => {
    it('should parse JSON messages', async () => {
      await wsSource.connect();
      
      const messageHandler = jest.fn();
      wsSource.on('message', messageHandler);
      
      wsSource.ws.simulateMessage('[{"value": 42}]');
      
      expect(messageHandler).toHaveBeenCalled();
      expect(messageHandler.mock.calls[0][0]).toEqual([{ value: 42 }]);
    });
    
    it('should parse CSV messages when format is csv', async () => {
      const csvSource = new WebSocketDataSource('ws://test.example.com/csv', {
        format: 'csv'
      });
      
      await csvSource.connect();
      
      const messageHandler = jest.fn();
      csvSource.on('message', messageHandler);
      
      csvSource.ws.simulateMessage('name,value\nTest,42');
      
      expect(messageHandler).toHaveBeenCalled();
      expect(messageHandler.mock.calls[0][0]).toEqual([{ name: 'Test', value: 42 }]);
      
      csvSource.disconnect();
    });
    
    it('should emit error for malformed JSON', async () => {
      await wsSource.connect();
      
      const errorHandler = jest.fn();
      wsSource.on('error', errorHandler);
      
      wsSource.ws.simulateMessage('not valid json');
      
      expect(errorHandler).toHaveBeenCalled();
    });
    
    it('should apply transform function', async () => {
      const transformSource = new WebSocketDataSource('ws://test.example.com/data', {
        transform: (record) => ({ ...record, processed: true })
      });
      
      await transformSource.connect();
      
      const messageHandler = jest.fn();
      transformSource.on('message', messageHandler);
      
      transformSource.ws.simulateMessage('[{"value": 42}]');
      
      expect(messageHandler.mock.calls[0][0][0]).toEqual({ value: 42, processed: true });
      
      transformSource.disconnect();
    });
  });
  
  describe('Sending Data', () => {
    it('should send string data', async () => {
      await wsSource.connect();
      
      const result = wsSource.send('hello');
      
      expect(result).toBe(true);
      expect(wsSource.ws.lastSent).toBe('hello');
    });
    
    it('should stringify object data', async () => {
      await wsSource.connect();
      
      const result = wsSource.send({ value: 42 });
      
      expect(result).toBe(true);
      expect(wsSource.ws.lastSent).toBe('{"value":42}');
    });
    
    it('should return false when not connected', () => {
      const result = wsSource.send('test');
      expect(result).toBe(false);
    });
    
    it('should emit error when not connected', () => {
      const errorHandler = jest.fn();
      wsSource.on('error', errorHandler);
      
      wsSource.send('test');
      
      expect(errorHandler).toHaveBeenCalled();
    });
  });
  
  describe('Event System', () => {
    it('should support on/off for event subscription', async () => {
      const handler = jest.fn();
      const unsubscribe = wsSource.on('message', handler);
      
      await wsSource.connect();
      wsSource.ws.simulateMessage('[{"test": true}]');
      
      expect(handler).toHaveBeenCalled();
      
      // Unsubscribe
      unsubscribe();
      handler.mockClear();
      wsSource.ws.simulateMessage('[{"test": false}]');
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('should get current records', async () => {
      await wsSource.connect();
      
      wsSource.ws.simulateMessage('[{"value": 1}, {"value": 2}]');
      
      const records = wsSource.getRecords();
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ value: 1 });
    });
  });
  
  describe('loadWebSocket helper', () => {
    it('should create and connect WebSocket source', async () => {
      const source = await loadWebSocket('ws://test.example.com/data');
      
      expect(source).toBeInstanceOf(WebSocketDataSource);
      expect(source.connected).toBe(true);
      
      source.disconnect();
    });
  });
});
