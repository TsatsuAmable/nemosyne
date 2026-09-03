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

/**
 * Small presentation bridge between headset UI and the existing governed
 * FileLoader -> Atlas -> Rust ingestion path. The bridge owns no analytical
 * behavior and never parses or transforms dataset bytes.
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
    return this.provider.listDatasets();
  }

  async openDataset(datasetId: string, tierId: string): Promise<void> {
    if (!this.provider) throw new Error('Dataset library is not ready yet');
    await this.provider.openDataset(datasetId, tierId);
  }
}

export const xrDatasetLibraryBridge = new XRDatasetLibraryBridge();
