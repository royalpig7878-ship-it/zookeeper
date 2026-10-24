import { ITEMS } from '../data/items';

export interface Slot {
  id: string;
  qty: number;
}

export const INVENTORY_SLOTS = 18;

export function countItem(inv: readonly Slot[], id: string): number {
  return inv.reduce((n, s) => (s.id === id ? n + s.qty : n), 0);
}

export function hasItem(inv: readonly Slot[], id: string): boolean {
  return countItem(inv, id) > 0;
}

/** How many of `id` would fit right now. */
export function roomFor(inv: readonly Slot[], id: string, capacity = INVENTORY_SLOTS): number {
  const stack = ITEMS[id]?.stack ?? 1;
  let room = 0;
  for (const s of inv) if (s.id === id) room += stack - s.qty;
  room += (capacity - inv.length) * stack;
  return room;
}

/** Add items, filling existing stacks first. Returns how many did NOT fit. */
export function addItem(inv: Slot[], id: string, qty: number, capacity = INVENTORY_SLOTS): number {
  if (!ITEMS[id]) throw new Error(`Unknown item: ${id}`);
  const stack = ITEMS[id].stack;
  let left = qty;
  for (const s of inv) {
    if (left <= 0) break;
    if (s.id !== id) continue;
    const add = Math.min(left, stack - s.qty);
    s.qty += add;
    left -= add;
  }
  while (left > 0 && inv.length < capacity) {
    const add = Math.min(left, stack);
    inv.push({ id, qty: add });
    left -= add;
  }
  return left;
}

/** Remove items. All-or-nothing: returns false (and changes nothing) if there aren't enough. */
export function removeItem(inv: Slot[], id: string, qty: number): boolean {
  if (countItem(inv, id) < qty) return false;
  let left = qty;
  for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
    if (inv[i].id !== id) continue;
    const take = Math.min(left, inv[i].qty);
    inv[i].qty -= take;
    left -= take;
    if (inv[i].qty === 0) inv.splice(i, 1);
  }
  return true;
}
