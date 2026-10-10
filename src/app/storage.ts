/**
 * A small key-value store in IndexedDB. Falls back to memory where IndexedDB is unavailable
 * (some private windows), so callers never have to care.
 * Two stores: "files" for avatar models you loaded, "rooms" for copies of rooms you've been in.
 */
export type StoreName = "files" | "rooms";

const DB_NAME = "piaskownica";
const DB_VERSION = 1;
const OPEN_TIMEOUT_MS = 4000;
const STORES: StoreName[] = ["files", "rooms"];

let opening: Promise<IDBDatabase | null> | null = null;
const memory: Record<StoreName, Map<string, unknown>> = { files: new Map(), rooms: new Map() };

function openDatabase(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
      setTimeout(() => resolve(null), OPEN_TIMEOUT_MS);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

type Op = (store: IDBObjectStore) => IDBRequest;

function request<T>(name: StoreName, mode: IDBTransactionMode, op: Op): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) {
          resolve(undefined);
          return;
        }
        try {
          const r = op(db.transaction(name, mode).objectStore(name));
          r.onsuccess = () => resolve(r.result as T);
          r.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function readStored<T = unknown>(name: StoreName, key: string): Promise<T | undefined> {
  const value = await request<T>(name, "readonly", (s) => s.get(key));
  return value !== undefined ? value : (memory[name].get(key) as T | undefined);
}

export async function writeStored(name: StoreName, key: string, value: unknown): Promise<void> {
  memory[name].set(key, value);
  await request(name, "readwrite", (s) => s.put(value, key));
  // the memory copy is only a fallback: once the database has it, let go
  if (await openDatabase()) memory[name].delete(key);
}

export async function removeStored(name: StoreName, key: string): Promise<void> {
  memory[name].delete(key);
  await request(name, "readwrite", (s) => s.delete(key));
}

export async function storedKeys(name: StoreName): Promise<string[]> {
  const keys = (await request<IDBValidKey[]>(name, "readonly", (s) => s.getAllKeys())) ?? [];
  return [...new Set([...keys.map(String), ...memory[name].keys()])];
}

/** hex SHA-256 of a buffer; names files you loaded so peers can check what they received */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
