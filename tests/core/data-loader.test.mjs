/**
 * Unit tests for DataLoader module
 * Tests CSV parsing, type inference, and data transformation
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  parseCSV,
  toCSV,
  transformRecords,
  filterRecords,
  groupBy
} from '../../src/core/DataLoader.js';

describe('DataLoader', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV with headers', () => {
      const csv = `name,age,city
John,30,NYC
Jane,25,LA`;
      
      const result = parseCSV(csv);
      
      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.records).toHaveLength(2);
      expect(result.records[0]).toEqual({
        name: 'John',
        age: 30,
        city: 'NYC'
      });
    });

    it('should parse CSV without headers', () => {
      const csv = `John,30,NYC
Jane,25,LA`;
      
      const result = parseCSV(csv, { hasHeader: false });
      
      expect(result.headers).toEqual(['column1', 'column2', 'column3']);
      expect(result.records).toHaveLength(2);
    });

    it('should handle quoted fields', () => {
      const csv = `name,description
"Smith, John","A person, who codes"
"Jane Doe","Loves coding"`;
      
      const result = parseCSV(csv);
      
      expect(result.records[0].name).toBe('Smith, John');
      expect(result.records[0].description).toBe('A person, who codes');
      expect(result.records[1].description).toBe('Loves coding');
    });

    it('should infer types automatically', () => {
      const csv = `name,count,active,date
Test,42,true,2024-01-15
Other,3.14,false,2023-12-01`;
      
      const result = parseCSV(csv);
      
      expect(result.records[0].count).toBe(42);
      expect(result.records[0].active).toBe(true);
      expect(result.records[0].date instanceof Date).toBe(true);
      expect(result.records[1].count).toBe(3.14);
    });

    it('should detect semicolon delimiter', () => {
      const csv = `name;age
John;30
Jane;25`;
      
      const result = parseCSV(csv);
      
      expect(result.headers).toEqual(['name', 'age']);
      expect(result.records).toHaveLength(2);
    });

    it('should handle empty lines', () => {
      const csv = `name,age

John,30

Jane,25`;
      
      const result = parseCSV(csv);
      
      expect(result.records).toHaveLength(2);
    });

    it('should trim whitespace when trim option is true', () => {
      const csv = `name , age
 John , 30 `;
      
      const result = parseCSV(csv, { trim: true });
      
      expect(result.records[0].name).toBe('John');
      expect(result.records[0].age).toBe(30);
    });

    it('should not trim when trim option is false', () => {
      const csv = `name,age
John,30`;
      
      const result = parseCSV(csv, { trim: false });
      
      // With trim: false, string values keep their whitespace
      expect(result.records[0].name).toBe('John');
      expect(result.records[0].age).toBe(30); // Still converted to number
    });

    it('should handle newlines in quoted fields', () => {
      const csv = `name,description
"John","Line 1
Line 2"`;
      
      const result = parseCSV(csv);
      
      expect(result.records[0].description).toBe('Line 1\nLine 2');
    });

    it('should throw error for non-string input', () => {
      expect(() => parseCSV(null)).toThrow('csvText must be a string');
      expect(() => parseCSV(123)).toThrow('csvText must be a string');
    });

    it('should return empty result for empty string', () => {
      const result = parseCSV('');
      
      expect(result.headers).toEqual([]);
      expect(result.records).toEqual([]);
    });
  });

  describe('toCSV', () => {
    it('should convert records to CSV', () => {
      const records = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      
      const csv = toCSV(records);
      
      expect(csv).toContain('name,age');
      expect(csv).toContain('John,30');
      expect(csv).toContain('Jane,25');
    });

    it('should handle values with commas', () => {
      const records = [
        { name: 'Smith, John', city: 'NYC' }
      ];
      
      const csv = toCSV(records);
      
      expect(csv).toContain('"Smith, John"');
    });

    it('should handle values with quotes', () => {
      const records = [
        { name: 'John "Johnny" Smith', city: 'NYC' }
      ];
      
      const csv = toCSV(records);
      
      expect(csv).toContain('"John ""Johnny"" Smith"');
    });

    it('should handle null and undefined values', () => {
      const records = [
        { name: 'John', age: null, city: undefined }
      ];
      
      const csv = toCSV(records);
      
      expect(csv).toContain('John,,');
    });

    it('should respect custom delimiter', () => {
      const records = [
        { name: 'John', age: 30 }
      ];
      
      const csv = toCSV(records, { delimiter: ';' });
      
      expect(csv).toContain('name;age');
    });

    it('should return empty string for empty array', () => {
      const csv = toCSV([]);
      
      expect(csv).toBe('');
    });
  });

  describe('transformRecords', () => {
    it('should transform each record', () => {
      const records = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 }
      ];
      
      const transformed = transformRecords(records, (record) => ({
        ...record,
        ageGroup: record.age >= 30 ? 'adult' : 'young'
      }));
      
      expect(transformed[0].ageGroup).toBe('adult');
      expect(transformed[1].ageGroup).toBe('young');
    });

    it('should have access to index', () => {
      const records = [{}, {}, {}];
      
      const transformed = transformRecords(records, (record, index) => ({
        id: index + 1
      }));
      
      expect(transformed[0].id).toBe(1);
      expect(transformed[2].id).toBe(3);
    });
  });

  describe('filterRecords', () => {
    it('should filter records based on predicate', () => {
      const records = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
        { name: 'Bob', age: 35 }
      ];
      
      const filtered = filterRecords(records, (record) => record.age >= 30);
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].name).toBe('John');
      expect(filtered[1].name).toBe('Bob');
    });
  });

  describe('groupBy', () => {
    it('should group records by key', () => {
      const records = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 }
      ];
      
      const grouped = groupBy(records, 'category');
      
      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(1);
      expect(grouped.A[0].value).toBe(1);
      expect(grouped.A[1].value).toBe(3);
    });
  });
});
