/**
 * IndexedDB Weight Store for Personalized Gesture Models.
 *
 * Saves, loads, and manages fine-tuned ONNX gesture model weight tensors and
 * biomechanical calibration parameters in local IndexedDB storage.
 */

export interface SavedGestureWeights {
  version: string;
  timestamp: number;
  weights: Record<string, number[]>;
  calibration: {
    moveThreshold: number;
    pinchThreshold: number;
    releaseThreshold: number;
  };
}

export class GestureModelStore {
  dbName: string;
  storeName: string;

  constructor(dbName = 'nemosyne_ai_db', storeName = 'gesture_weights') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private _openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = window.indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Save fine-tuned model weight tensors and calibration settings.
   */
  async saveWeights(key: string, data: SavedGestureWeights): Promise<boolean> {
    try {
      const db = await this._openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(data, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[GestureModelStore] Save failed, fallback to memory:', err);
      return false;
    }
  }

  /**
   * Load personalized model weight tensors from IndexedDB.
   */
  async loadWeights(key: string): Promise<SavedGestureWeights | null> {
    try {
      const db = await this._openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[GestureModelStore] Load skipped:', err);
      return null;
    }
  }

  /**
   * Clear saved weights reset to default master model.
   */
  async clearWeights(key: string): Promise<boolean> {
    try {
      const db = await this._openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return false;
    }
  }
}
