/**
 * DataNativeEngine — Minimal Edition
 * Core data processing without research/bloat components
 */

import { LayoutEngine } from './LayoutEngine.js';
import { PropertyMapper } from './PropertyMapper.js';

class DataNativeEngine extends EventTarget {
  constructor(options = {}) {
    super();
    
    this.propertyMapper = new PropertyMapper();
    this.layoutEngine = new LayoutEngine(options.layout);
    
    /** @type {Map<string, Object>} */
    this.activeDatasets = new Map();
    
    /** @type {string | null} */
    this.currentDatasetId = null;
    
    this.config = {
      autoVisualize: true,
      autoLayout: true,
      animationDuration: 500,
      ...options
    };
  }

  /**
   * Load and register a dataset
   * @param {string} id — Dataset identifier
   * @param {Array<Object>} data — Array of data records
   * @param {Object} [options={}] — Dataset options
   */
  loadDataset(id, data, options = {}) {
    if (!Array.isArray(data)) {
      throw new TypeError('Data must be an array');
    }
    
    const dataset = {
      id,
      data,
      recordCount: data.length,
      loadedAt: Date.now(),
      options: { ...this.config, ...options }
    };
    
    this.activeDatasets.set(id, dataset);
    this.currentDatasetId = id;
    
    this.dispatchEvent(new CustomEvent('dataset-loaded', {
      detail: { id, recordCount: data.length }
    }));
    
    return dataset;
  }

  /**
   * Get current dataset
   * @returns {Object | undefined}
   */
  getCurrentDataset() {
    return this.currentDatasetId 
      ? this.activeDatasets.get(this.currentDatasetId) 
      : undefined;
  }

  /**
   * Switch to a different dataset
   * @param {string} id
   */
  switchDataset(id) {
    if (!this.activeDatasets.has(id)) {
      throw new Error(`Dataset '${id}' not found`);
    }
    
    this.currentDatasetId = id;
    
    this.dispatchEvent(new CustomEvent('dataset-switched', {
      detail: { id }
    }));
    
    return this.activeDatasets.get(id);
  }

  /**
   * Calculate layout positions for data
   * @param {string} layoutType — Layout algorithm name
   * @param {Array<Object>} data — Data to layout
   * @param {Object} [options={}] — Layout options
   * @returns {Array<{x: number, y: number, z: number}>}
   */
  calculateLayout(layoutType, data, options = {}) {
    return this.layoutEngine.calculate(layoutType, data, options);
  }

  /**
   * Map data properties to visual properties
   * @param {Object} mapping — Property mapping specification
   * @param {Object} data — Data record
   * @returns {Object}
   */
  mapProperties(mapping, data) {
    return this.propertyMapper.execute(mapping, data);
  }

  /**
   * Get summary statistics for current dataset
   * @returns {Object}
   */
  getStats() {
    const dataset = this.getCurrentDataset();
    if (!dataset) return { loaded: false };
    
    const data = dataset.data;
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    
    return {
      loaded: true,
      id: dataset.id,
      recordCount: data.length,
      fields: keys,
      loadedAt: new Date(dataset.loadedAt).toISOString()
    };
  }

  /**
   * Destroy the engine and clean up
   */
  destroy() {
    this.activeDatasets.clear();
    this.currentDatasetId = null;
    this.removeEventListeners?.();
  }
}

export { DataNativeEngine };
export default DataNativeEngine;
