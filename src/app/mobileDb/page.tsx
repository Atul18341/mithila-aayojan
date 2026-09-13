'use client';

import React, { useState } from 'react';

export default function IndexedDBViewerPage() {
  const [dbData, setDbData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayIndexedDB = async () => {
    setLoading(true);
    setError(null);
    setDbData([]);

    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        setError('IndexedDB is not supported in this environment.');
        setLoading(false);
        return;
      }

      if (!indexedDB.databases) {
        setError('indexedDB.databases() API is not supported in this browser version.');
        setLoading(false);
        return;
      }

      const dbs = await indexedDB.databases();
      if (dbs.length === 0) {
        setError('No IndexedDB databases found for this origin.');
        setLoading(false);
        return;
      }

      const results: any[] = [];

      for (const dbInfo of dbs) {
        const dbName = dbInfo.name;
        if (!dbName) continue;

        const dbDetails: { name: string; stores: { name: string; data: any }[] } = {
          name: dbName,
          stores: [],
        };

        await new Promise<void>((resolve) => {
          const request = indexedDB.open(dbName);
          request.onsuccess = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            const storeNames = Array.from(db.objectStoreNames);

            if (storeNames.length === 0) {
              results.push(dbDetails);
              resolve();
              return;
            }

            let completedStores = 0;
            storeNames.forEach((storeName) => {
              const tx = db.transaction(storeName, 'readonly');
              const store = tx.objectStore(storeName);
              const getAll = store.getAll();

              getAll.onsuccess = () => {
                dbDetails.stores.push({
                  name: storeName,
                  data: getAll.result,
                });
                completedStores++;
                if (completedStores === storeNames.length) {
                  results.push(dbDetails);
                  resolve();
                }
              };

              getAll.onerror = () => {
                completedStores++;
                if (completedStores === storeNames.length) {
                  results.push(dbDetails);
                  resolve();
                }
              };
            });
          };
          request.onerror = () => {
            resolve();
          };
        });
      }

      setDbData(results);
    } catch (err: any) {
      setError(err.message || 'Failed to read IndexedDB.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 font-mono">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-cyan-400">IndexedDB Inspector</h1>
            <p className="text-xs text-slate-400 mt-1">Client-side storage viewer route</p>
          </div>
          <button
            onClick={displayIndexedDB}
            disabled={loading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm rounded-md font-sans transition-colors cursor-pointer"
          >
            {loading ? 'Scanning...' : 'Inspect Databases'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-950/50 border border-red-800 text-red-300 rounded-md text-sm">
            {error}
          </div>
        )}

        {dbData && dbData.length === 0 && !loading && (
          <div className="text-slate-500 text-sm">No databases found or inspection complete with empty results.</div>
        )}

        {dbData && dbData.length > 0 && (
          <div className="space-y-6">
            {dbData.map((db, dbIdx) => (
              <div key={dbIdx} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
                <h2 className="text-amber-400 font-semibold border-b border-slate-800 pb-2">
                  Database: {db.name}
                </h2>
                {db.stores.length === 0 ? (
                  <p className="text-slate-500 text-xs">No object stores found.</p>
                ) : (
                  db.stores.map((store: any, storeIdx: number) => (
                    <div key={storeIdx} className="space-y-2">
                      <div className="text-xs text-slate-300 font-semibold">
                        Store: <span className="text-cyan-300">{store.name}</span>
                      </div>
                      <pre className="bg-slate-950 text-emerald-400 p-3 rounded-md text-xs overflow-x-auto max-h-60 border border-slate-800/80">
                        {JSON.stringify(store.data, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}