export {
  PROJECT_ROLE_IDS,
  WORKSPACE_ROLE_IDS,
  projectRoleNameById,
  workspaceRoleNameById,
} from '@/lib/api/schemas/roles';

export function newId(): string {
  return crypto.randomUUID();
}

/** Deterministic PRNG so the seed is identical on every fresh load. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const hex = (length: number) => {
    let out = '';
    for (let i = 0; i < length; i++) out += Math.floor(next() * 16).toString(16);
    return out;
  };

  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    uuid: () => {
      const variant = '89ab'[Math.floor(next() * 4)];
      return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
