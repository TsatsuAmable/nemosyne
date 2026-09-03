export interface XRDatasetLibraryTier {
  id: string;
  label: string;
  rows: number;
}

export interface XRDatasetLibraryEntry {
  id: string;
  label: string;
  version: string;
  description: string;
  tiers: XRDatasetLibraryTier[];
}

export interface XRDatasetLibraryProvider {
  listDatasets(): Promise<XRDatasetLibraryEntry[]>;
  openDataset(datasetId: string, tierId: string): Promise<void>;
}

const MAX_XR_DATASETS = 24;
const MAX_XR_TIERS_PER_DATASET = 4;

/**
 * Small presentation bridge between headset UI and the existing governed
 * FileLoader -> Atlas -> Rust ingestion path. The bridge owns no analytical
 * behavior and never parses or transforms dataset bytes. It also bounds the
 * amount of catalogue material projected into the headset menu so a future
 * large catalogue cannot create an unbounded UI surface.
 */
class XRDatasetLibraryBridge {
  private provider: XRDatasetLibraryProvider | null = null;

  attach(provider: XRDatasetLibraryProvider): () => void {
    this.provider = provider;
    return () => {
      if (this.provider === provider) this.provider = null;
    };
  }

  isAvailable(): boolean {
    return this.provider !== null;
  }

  async listDatasets(): Promise<XRDatasetLibraryEntry[]> {
    if (!this.provider) throw new Error('Dataset library is not ready yet');
    const entries = await this.provider.listDatasets();
    return entries.slice(0, MAX_XR_DATASETS).map((entry) => ({
      ...entry,
      tiers: entry.tiers.slice(0, MAX_XR_TIERS_PER_DATASET),
    }));
  }

  async openDataset(datasetId: string, tierId: string): Promise<void> {
    if (!this.provider) throw new Error('Dataset library is not ready yet');
    await this.provider.openDataset(datasetId, tierId);
  }
}

export const xrDatasetLibraryBridge = new XRDatasetLibraryBridge();
