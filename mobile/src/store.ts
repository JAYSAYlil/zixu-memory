import { useSyncExternalStore } from 'react';
import { emptyLibrary, type Library } from './core';
import { readLibrary, writeLibrary, writeDraft } from './persistence';
let current = emptyLibrary();
let initialized = false;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
let queue: Promise<void> = Promise.resolve();
function emit() {
  listeners.forEach((fn) => fn());
}
export async function initialize() {
  if (initialized) return;
  if (!loading)
    loading = (async () => {
      current = await readLibrary();
      initialized = true;
      emit();
    })().finally(() => {
      loading = undefined;
    });
  await loading;
}
export function snapshot() {
  return current;
}
export function mutate(fn: (state: Library) => Library): Promise<void> {
  const run = queue.then(async () => {
    await initialize();
    const next = fn(current);
    if (next.memories === current.memories && next.insights === current.insights)
      await writeDraft(next);
    else await writeLibrary(next, current);
    current = next;
    emit();
  });
  queue = run.catch(() => {});
  return run;
}
export function useLibrary() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    snapshot,
    snapshot,
  );
}
