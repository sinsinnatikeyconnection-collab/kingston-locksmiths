export type TierId = "bronze" | "silver" | "gold" | "platinum";

export interface Tier {
  id: TierId;
  label: string;
  min: number;
  perk: string;
}

export const TIERS: Tier[] = [
  { id: "bronze", label: "Bronze", min: 0, perk: "5% off diagnostics" },
  { id: "silver", label: "Silver", min: 250, perk: "10% off + priority booking" },
  { id: "gold", label: "Gold", min: 750, perk: "15% off + free mobile visit" },
  { id: "platinum", label: "Platinum", min: 2000, perk: "20% off + concierge dispatch" },
];

export function tierFor(points: number): TierId {
  let t: TierId = "bronze";
  for (const x of TIERS) if (points >= x.min) t = x.id;
  return t;
}

export function activeTierIndex(points: number): number {
  let idx = 0;
  TIERS.forEach((x, i) => {
    if (points >= x.min) idx = i;
  });
  return idx;
}

export function currentTier(points: number): Tier {
  return TIERS[activeTierIndex(points)];
}

export function nextTier(points: number): Tier | null {
  const idx = activeTierIndex(points);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

export interface LoyaltyAccount {
  id?: string;
  owner_email: string;
  owner_email_lower?: string;
  points_balance: number;
  lifetime_points: number;
  tier: TierId;
  last_earned_date?: string;
  created_date?: string;
}

export interface LoyaltyTransaction {
  id?: string;
  owner_email: string;
  owner_email_lower?: string;
  points: number;
  reason: string;
  reference?: string;
  created_date?: string;
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10);