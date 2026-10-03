// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from "vitest";
import {
  FileLoaderUI,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_COLUMNS,
} from "../src/ui/FileLoader.ts";
import { AtlasCore } from "../src/atlas/AtlasCore.ts";
import * as bridge from "../src/wasm/RuntimeBridge.ts";
import { Dataset } from "../src/data/Dataset.ts";

describe("RF-039 Upload Ingress Assurance (FileLoader -> Atlas -> Rust -> Dataset)", () => {
  let onLoad: any;
  let loader: FileLoaderUI;
  let atlas: AtlasCore;

  beforeAll(async () => {
    if (!bridge.isReady()) {
      await bridge.initRuntime("/wasm/pkg/nemosyne_wasm_bg.wasm");
    }
    if (!bridge.isReady()) {
      throw new Error("WASM RuntimeBridge failed to initialise for upload ingress assurance tests.");
    }
  });

  beforeEach(() => {
    onLoad = vi.fn();
    atlas = new AtlasCore({ kernel: bridge });
    loader = new FileLoaderUI({ onLoad, atlas });
  });

  afterEach(() => {
    loader.dispose();
    vi.restoreAllMocks();
    delete (Object.prototype as any).polluted;
    delete (Object.prototype as any).polluted1;
    delete (Object.prototype as any).polluted2;
    delete (Object.prototype as any).polluted3;
    delete (Object.prototype as any).isAdmin;
    delete (Object.prototype as any).injected;
    delete (Object.prototype as any).exploit;
    delete (Object.prototype as any).evilVal1;
    delete (Object.prototype as any).deepExploit;
  });

  describe("Pre-read ingress gating", () => {
    it("refuses oversized file before reading content or allocating bytes", async () => {
      const arrayBufferSpy = vi.fn();
      const textSpy = vi.fn();
      const oversizedFile = {
        name: "oversized.csv",
        size: MAX_IMPORT_BYTES + 1,
        arrayBuffer: arrayBufferSpy,
        text: textSpy,
      } as unknown as File;

      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [oversizedFile], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 20));

      expect(arrayBufferSpy).not.toHaveBeenCalled();
      expect(textSpy).not.toHaveBeenCalled();
      expect(onLoad).not.toHaveBeenCalled();

      const statusEl = loader.container.querySelector("#loader-status")!;
      expect(statusEl.textContent).toContain("File too large");
      expect(statusEl.textContent).toContain("import cap is 256 MB");
    });

    it("refuses invalid or non-numeric file sizes fail-closed before reading", async () => {
      const invalidSizes = [NaN, -1, -500, undefined, "256" as any];
      for (const size of invalidSizes) {
        const arrayBufferSpy = vi.fn();
        const file = {
          name: "data.csv",
          size,
          arrayBuffer: arrayBufferSpy,
        } as unknown as File;

        const input = loader.container.querySelector("input[type=\"file\"]")!;
        Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
        input.dispatchEvent(new Event("change"));

        await new Promise((r) => setTimeout(r, 20));

        expect(arrayBufferSpy).not.toHaveBeenCalled();
        expect(onLoad).not.toHaveBeenCalled();

        const statusEl = loader.container.querySelector("#loader-status")!;
        expect(statusEl.textContent).toContain("File rejected: invalid file size.");
      }
    });

    it("refuses unsupported file extensions before reading file content", async () => {
      const unsupportedNames = ["payload.exe", "script.sh", "image.png", "doc.pdf", "data"];
      for (const name of unsupportedNames) {
        const arrayBufferSpy = vi.fn();
        const file = {
          name,
          size: 1024,
          arrayBuffer: arrayBufferSpy,
        } as unknown as File;

        const input = loader.container.querySelector("input[type=\"file\"]")!;
        Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
        input.dispatchEvent(new Event("change"));

        await new Promise((r) => setTimeout(r, 20));

        expect(arrayBufferSpy).not.toHaveBeenCalled();
        expect(onLoad).not.toHaveBeenCalled();

        const statusEl = loader.container.querySelector("#loader-status")!;
        expect(statusEl.textContent).toContain("Unsupported file type; use .csv or .json");
      }
    });

    it("refuses malicious filenames (path traversal, null bytes, control chars, length cap) before reading", async () => {
      const maliciousNames = [
        "../../etc/passwd.csv",
        "..\\..\\windows\\system32.csv",
        "data\0.csv",
        "bad\x1fcontrol.csv",
        "evil\x7fdel.csv",
        "path/to/nested.csv",
        "a".repeat(129) + ".csv",
      ];

      for (const name of maliciousNames) {
        const arrayBufferSpy = vi.fn();
        const file = {
          name,
          size: 1024,
          arrayBuffer: arrayBufferSpy,
        } as unknown as File;

        const input = loader.container.querySelector("input[type=\"file\"]")!;
        Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
        input.dispatchEvent(new Event("change"));

        await new Promise((r) => setTimeout(r, 20));

        expect(arrayBufferSpy).not.toHaveBeenCalled();
        expect(onLoad).not.toHaveBeenCalled();

        const statusEl = loader.container.querySelector("#loader-status")!;
        expect(statusEl.textContent).toContain("File name rejected: contains unsafe characters or is too long.");
      }
    });

    it("enforces post-read byte length defense if file.size was spoofed", async () => {
      const spoofedFile = {
        name: "spoofed.csv",
        size: 10,
        arrayBuffer: vi.fn(async () => new ArrayBuffer(MAX_IMPORT_BYTES + 10)),
      } as unknown as File;

      const parseBytesSpy = vi.spyOn(atlas, "parseBytes");

      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [spoofedFile], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(parseBytesSpy).not.toHaveBeenCalled();
      expect(onLoad).not.toHaveBeenCalled();

      const statusEl = loader.container.querySelector("#loader-status")!;
      expect(statusEl.textContent).toContain("File too large");
    });
  });

  describe("Authoritative Rust/WASM parsing & prototype pollution defense", () => {
    it("neutralises CSV prototype pollution through the live FileLoader -> Atlas -> Rust -> Dataset path", async () => {
      const maliciousCsv = [
        "__proto__,constructor,prototype,metric",
        "polluted1,polluted2,polluted3,100",
        "evilVal1,evilVal2,evilVal3,200",
      ].join("\n");

      const file = new File([maliciousCsv], "attack.csv", { type: "text/csv" });
      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(onLoad).toHaveBeenCalled();
      const emitted = onLoad.mock.calls[0][0];
      const dataset: Dataset = emitted.dataset;

      expect((Object.prototype as any).polluted1).toBeUndefined();
      expect((Object.prototype as any).polluted2).toBeUndefined();
      expect((Object.prototype as any).polluted3).toBeUndefined();
      expect((Object.prototype as any).evilVal1).toBeUndefined();

      // Only the legitimate metric column survived sanitization
      expect(dataset.columnCount).toBe(1);
      expect(dataset.columns[0].name).toBe("metric");
      expect(dataset.rowCount).toBe(2);
      expect(dataset.rows[0].metric).toBe(100);
      expect(dataset.rows[1].metric).toBe(200);

      expect(Object.prototype.hasOwnProperty.call(dataset.rows[0], "__proto__")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(dataset.rows[0], "constructor")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(dataset.rows[0], "prototype")).toBe(false);
    });

    it("neutralises deep JSON prototype pollution through the live FileLoader -> Atlas -> Rust -> Dataset path", async () => {
      const maliciousJson = JSON.stringify([
        {
          id: 1,
          label: "Alpha",
          __proto__: { polluted: "exploited", isAdmin: true },
          prototype: { exploit: true },
        },
        {
          id: 2,
          label: "Beta",
          constructor: { injected: "deep_exploit" },
        },
      ]);

      const file = new File([maliciousJson], "exploit.json", { type: "application/json" });
      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(onLoad).toHaveBeenCalled();
      const emitted = onLoad.mock.calls[0][0];
      const dataset: Dataset = emitted.dataset;

      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect((Object.prototype as any).injected).toBeUndefined();
      expect((Object.prototype as any).exploit).toBeUndefined();

      // Dangerous columns stripped
      expect(dataset.columns.map((c) => c.name)).toEqual(["id", "label"]);
      expect(dataset.rowCount).toBe(2);
      expect(dataset.rows[0].id).toBe(1);
      expect(dataset.rows[0].label).toBe("Alpha");
      expect(Object.prototype.hasOwnProperty.call(dataset.rows[0], "__proto__")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(dataset.rows[0], "prototype")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(dataset.rows[1], "constructor")).toBe(false);
    });

    it("deeply sanitizes nested objects passed into Dataset constructor", () => {
      const maliciousRow = {
        id: 1,
        nested: {
          constructor: {
            prototype: { deepExploit: true },
          },
          normalField: 42,
        },
      };

      const ds = new Dataset("test", [{ name: "id", type: "NUMERIC" }], [maliciousRow]);
      expect((Object.prototype as any).deepExploit).toBeUndefined();
      const nested = ds.rows[0].nested as Record<string, unknown>;
      expect(nested).toBeDefined();
      expect(nested.normalField).toBe(42);
      expect(Object.prototype.hasOwnProperty.call(nested, "constructor")).toBe(false);
    });

    it("fails closed on malformed JSON without crashing or polluting state", async () => {
      const malformedJson = `[ { "id": 1, "broken": `;
      const file = new File([malformedJson], "broken.json", { type: "application/json" });

      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(onLoad).not.toHaveBeenCalled();
      const statusEl = loader.container.querySelector("#loader-status")!;
      expect(statusEl.textContent).toContain("Error parsing file:");
      const schemaEl = loader.container.querySelector("#loader-schema") as HTMLElement;
      expect(schemaEl.style.display).toBe("none");
    });

    it("fails closed on malformed/unparseable CSV through the Rust parser", async () => {
      const emptyCsv = "";
      const file = new File([emptyCsv], "empty.csv", { type: "text/csv" });

      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(onLoad).not.toHaveBeenCalled();
      const statusEl = loader.container.querySelector("#loader-status")!;
      expect(statusEl.textContent).toContain("Error");
    });
  });

  describe("Shape and schema limit validation", () => {
    it("enforces MAX_ROWS_EXCEEDED limit through validateImport", async () => {
      const columns = [{ name: "id", type: "NUMERIC" as const }];
      const rows = new Array(MAX_IMPORT_ROWS + 1).fill(null).map((_, i) => ({ id: i }));
      const oversizedDataset = new Dataset("oversized", columns, rows);

      vi.spyOn(atlas, "parseBytes").mockReturnValueOnce({
        dataset: oversizedDataset,
        topology: "TABULAR",
        encodings: {},
      });

      const file = new File(["dummy"], "large.csv", { type: "text/csv" });
      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(onLoad).not.toHaveBeenCalled();
      const statusEl = loader.container.querySelector("#loader-status")!;
      expect(statusEl.textContent).toContain(
        `Error: Dataset has ${MAX_IMPORT_ROWS + 1} rows; maximum allowed is ${MAX_IMPORT_ROWS}.`
      );
    });

    it("enforces MAX_COLUMNS_EXCEEDED limit through validateImport", async () => {
      const columns = new Array(MAX_IMPORT_COLUMNS + 1).fill(null).map((_, i) => ({
        name: `col_${i}`,
        type: "NUMERIC" as const,
      }));
      const row: Record<string, unknown> = {};
      columns.forEach((c) => (row[c.name] = 1));
      const wideDataset = new Dataset("wide", columns, [row]);

      vi.spyOn(atlas, "parseBytes").mockReturnValueOnce({
        dataset: wideDataset,
        topology: "TABULAR",
        encodings: {},
      });

      const file = new File(["dummy"], "wide.csv", { type: "text/csv" });
      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(onLoad).not.toHaveBeenCalled();
      const statusEl = loader.container.querySelector("#loader-status")!;
      expect(statusEl.textContent).toContain(
        `Error: Dataset has ${MAX_IMPORT_COLUMNS + 1} columns; maximum allowed is ${MAX_IMPORT_COLUMNS}.`
      );
    });

    it("enforces NO_ROWS refusal when file has only header and no observations", async () => {
      const headerOnly = "id,name,value\n";
      const file = new File([headerOnly], "header_only.csv", { type: "text/csv" });

      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(onLoad).not.toHaveBeenCalled();
      const statusEl = loader.container.querySelector("#loader-status")!;
      expect(statusEl.textContent).toContain("Error: The file has a header but no data rows.");
    });

    it("enforces ROW_LENGTH_MISMATCH refusal when rows exceed column mismatch tolerance", async () => {
      const columns = [
        { name: "a", type: "NUMERIC" as const },
        { name: "b", type: "NUMERIC" as const },
      ];
      const rows = [
        { a: 1, b: 2 },
        { a: 3 }, // 1 key instead of 2 (50% mismatch)
      ];
      const mismatchedDataset = new Dataset("mismatch", columns, rows);

      vi.spyOn(atlas, "parseBytes").mockReturnValueOnce({
        dataset: mismatchedDataset,
        topology: "TABULAR",
        encodings: {},
      });

      const file = new File(["dummy"], "mismatch.csv", { type: "text/csv" });
      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(onLoad).not.toHaveBeenCalled();
      const statusEl = loader.container.querySelector("#loader-status")!;
      expect(statusEl.textContent).toContain("different number of columns than the header");
    });
  });

  describe("Analytical authority verification", () => {
    it("routes parsing strictly through AtlasCore and Rust WASM kernel without JS fallbacks", async () => {
      const parseBytesSpy = vi.spyOn(atlas, "parseBytes");
      const loadCsvSpy = vi.spyOn(bridge, "loadCsv");

      const validCsv = "x,y\n1,10\n2,20\n";
      const file = new File([validCsv], "valid.csv", { type: "text/csv" });

      const input = loader.container.querySelector("input[type=\"file\"]")!;
      Object.defineProperty(input, "files", { value: [file], writable: false, configurable: true });
      input.dispatchEvent(new Event("change"));

      await new Promise((r) => setTimeout(r, 50));

      expect(parseBytesSpy).toHaveBeenCalledTimes(1);
      expect(loadCsvSpy).toHaveBeenCalledTimes(1);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });
  });
});
