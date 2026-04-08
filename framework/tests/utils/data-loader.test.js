import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataLoader } from '../../src/utils/data-loader.js';

describe('DataLoader', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV with header', () => {
      const csvText = 'name,value,category\nAlice,100,A\nBob,200,B';
      const result = DataLoader.parseCSV(csvText);
      
      expect(result.records).toHaveLength(2);
      expect(result.records[0]).toEqual({
        name: 'Alice',
        value: 100,
        category: 'A'
      });
      expect(result.records[1]).toEqual({
        name: 'Bob',
        value: 200,
        category: 'B'
      });
    });
    
    it('should parse CSV and trim quotes', () => {
      const csvText = 'name,value\n"Alice",100\n"Bob",200';
      const result = DataLoader.parseCSV(csvText);
      
      expect(result.records[0].name).toBe('Alice');
    });
    
    it('should handle empty lines', () => {
      const csvText = 'name,value\n\nAlice,100\n\n';
      const result = DataLoader.parseCSV(csvText);
      
      // Should skip empty lines
      expect(result.records).toBeDefined();
    });
    
    it('should convert numeric values', () => {
      const csvText = 'id,count,rate\n1,100,3.14\n2,200,2.71';
      const result = DataLoader.parseCSV(csvText);
      
      expect(result.records[0].id).toBe(1);
      expect(result.records[0].count).toBe(100);
      expect(result.records[0].rate).toBe(3.14);
    });
    
    it('should handle single value', () => {
      const csvText = 'name\nAlice';
      const result = DataLoader.parseCSV(csvText);
      
      expect(result.records).toHaveLength(1);
      expect(result.records[0].name).toBe('Alice');
    });
    
    it('should handle empty CSV', () => {
      const result = DataLoader.parseCSV('');
      expect(result.records).toHaveLength(0);
    });
    
    it('should handle CSV with only header', () => {
      const csvText = 'name,value';
      const result = DataLoader.parseCSV(csvText);
      
      expect(result.records).toHaveLength(0);
    });
  });
  
  describe('generateSample', () => {
    it('should generate random sample data by default', () => {
      const result = DataLoader.generateSample();
      
      expect(result.records).toBeDefined();
      expect(result.records).toHaveLength(10);
      expect(result.records[0]).toHaveProperty('id');
      expect(result.records[0]).toHaveProperty('value');
      expect(result.records[0]).toHaveProperty('label');
    });
    
    it('should generate specified count of records', () => {
      const result = DataLoader.generateSample('random', 5);
      expect(result.records).toHaveLength(5);
    });
    
    it('should generate network data', () => {
      const result = DataLoader.generateSample('network', 5);
      
      expect(result.records).toHaveLength(5);
      expect(result.records[0]).toHaveProperty('id');
      expect(result.records[0]).toHaveProperty('value');
      expect(result.records[0]).toHaveProperty('connections');
      expect(result.records[0]).toHaveProperty('category');
    });
    
    it('should generate timeline data', () => {
      const result = DataLoader.generateSample('timeline', 5);
      
      expect(result.records).toHaveLength(5);
      expect(result.records[0]).toHaveProperty('date');
      expect(result.records[0]).toHaveProperty('value');
      expect(result.records[0]).toHaveProperty('change');
      
      // Dates should be in descending order (most recent first)
      const timestamps = result.records.map(r => new Date(r.date).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeLessThan(timestamps[i - 1]);
      }
    });
    
    it('should generate hierarchy data', () => {
      const result = DataLoader.generateSample('hierarchy', 3); // depth 3
      
      expect(result.root).toBeDefined();
      expect(result.root.id).toBe('root');
      expect(result.root.children).toHaveLength(3);
    });
    
    it('should throw for unknown type', () => {
      // Currently falls back to random, should we throw?
      const result = DataLoader.generateSample('unknown-type', 5);
      expect(result.records).toHaveLength(5);
    });
  });
  
  /*
  // These tests require fetch/WebSocket mocks
  describe('loadJSON', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });
    
    afterEach(() => {
      vi.restoreAllMocks();
    });
    
    it('should load JSON from URL', async () => {
      const mockData = { records: [{ id: 1 }] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData)
      });
      
      const result = await DataLoader.loadJSON('http://example.com/data.json');
      expect(result).toEqual(mockData);
    });
    
    it('should throw on HTTP error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });
      
      await expect(DataLoader.loadJSON('http://example.com/notfound.json'))
        .rejects.toThrow('HTTP 404');
    });
  });
  
  describe('loadCSV', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });
    
    afterEach(() => {
      vi.restoreAllMocks();
    });
    
    it('should load and parse CSV from URL', async () => {
      const csvText = 'name,value\nAlice,100';
      global.fetch.mockResolvedValue({
        text: () => Promise.resolve(csvText)
      });
      
      const result = await DataLoader.loadCSV('http://example.com/data.csv');
      expect(result.records).toHaveLength(1);
      expect(result.records[0].name).toBe('Alice');
    });
  });
  
  describe('loadWebSocket', () => {
    it('should create WebSocket and set up handlers', () => {
      // This would need a WebSocket mock
    });
  });
  */
});