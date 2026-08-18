/**
 * Transient Context Cards & Workspace Hub (Sprint 24.5).
 *
 * Ephemeral cards for meaningful moments (dataset loaded, recommendation available,
 * drift detected) that auto-dismiss and present immediate actionable operations,
 * reducing the need for permanent cluttered panels.
 */

export interface CardAction {
  id: string;
  label: string;
  isPrimary?: boolean;
}

export interface TransientCard {
  id: string;
  title: string;
  summary: string;
  type: 'dataset_loaded' | 'recommendation' | 'drift_alert' | 'study_checkpoint';
  actions: CardAction[];
  ttlMs: number;
  createdAt: number;
}

export class TransientContextCardManager {
  private _cards: TransientCard[] = [];
  private _onAction?: (cardId: string, actionId: string) => void;
  private _maxConcurrent = 3;

  constructor(options: { onAction?: (cardId: string, actionId: string) => void; maxConcurrent?: number } = {}) {
    this._onAction = options.onAction;
    if (options.maxConcurrent) {
      this._maxConcurrent = options.maxConcurrent;
    }
  }

  get activeCards(): readonly TransientCard[] {
    return this._cards;
  }

  spawnDatasetLoadedCard(name: string, rowCount: number, topology: string): TransientCard {
    const card: TransientCard = {
      id: `card-dataset-${Date.now()}`,
      title: `Dataset Loaded: ${name}`,
      summary: `${rowCount.toLocaleString()} rows · ${topology} topology`,
      type: 'dataset_loaded',
      actions: [
        { id: 'inspect', label: 'Inspect Rows', isPrimary: true },
        { id: 'analyse', label: 'Analyse Topology' },
        { id: 'dismiss', label: 'Dismiss' },
      ],
      ttlMs: 8000,
      createdAt: Date.now(),
    };
    this.addCard(card);
    return card;
  }

  spawnRecommendationCard(title: string, insight: string): TransientCard {
    const card: TransientCard = {
      id: `card-rec-${Date.now()}`,
      title: `Atlas Insight: ${title}`,
      summary: insight,
      type: 'recommendation',
      actions: [
        { id: 'view', label: 'View Cluster', isPrimary: true },
        { id: 'explain', label: 'Explain' },
        { id: 'ignore', label: 'Ignore' },
      ],
      ttlMs: 12000,
      createdAt: Date.now(),
    };
    this.addCard(card);
    return card;
  }

  addCard(card: TransientCard): void {
    if (this._cards.length >= this._maxConcurrent) {
      // Evict oldest card
      this._cards.shift();
    }
    this._cards.push(card);
  }

  dismissCard(id: string): boolean {
    const idx = this._cards.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this._cards.splice(idx, 1);
      return true;
    }
    return false;
  }

  triggerAction(cardId: string, actionId: string): boolean {
    const card = this._cards.find((c) => c.id === cardId);
    if (!card) return false;

    this._onAction?.(cardId, actionId);
    this.dismissCard(cardId);
    return true;
  }

  tick(currentTimeMs = Date.now()): void {
    this._cards = this._cards.filter((card) => currentTimeMs - card.createdAt < card.ttlMs);
  }
}
