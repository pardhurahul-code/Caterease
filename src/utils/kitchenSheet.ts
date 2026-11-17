export interface KitchenItemInput {
  itemName: string;
  quantity: number;
  dietaryType?: string | null;
  allergens?: string | null;
  prepTimeMins?: number | null;
}

export interface KitchenComplianceMatrix {
  totalPortions: number;
  dietaryBreakdown: {
    Veg: number;
    'Non-Veg': number;
    Vegan: number;
    Jain: number;
  };
  detectedAllergens: string[];
  requiresJainIsolation: boolean;
  requiresAllergenIsolation: boolean;
  maxPrepTimeMins: number;
  equipmentChecklist: string[];
}

export function buildKitchenComplianceMatrix(
  items: KitchenItemInput[],
  guestCount: number,
  packageIncludedItems: string[] = [],
  dietaryRequirements?: string | null
): KitchenComplianceMatrix {
  const breakdown = {
    Veg: 0,
    'Non-Veg': 0,
    Vegan: 0,
    Jain: 0,
  };

  const allergenSet = new Set<string>();
  let totalPortions = 0;
  let maxPrepTimeMins = 45;

  for (const item of items) {
    totalPortions += item.quantity;
    const dtype = item.dietaryType || 'Veg';
    if (dtype === 'Non-Veg') breakdown['Non-Veg'] += 1;
    else if (dtype === 'Vegan') breakdown.Vegan += 1;
    else if (dtype === 'Jain') breakdown.Jain += 1;
    else breakdown.Veg += 1;

    if (item.allergens && item.allergens.trim().toLowerCase() !== 'none') {
      for (const part of item.allergens.split(',')) {
        const clean = part.trim();
        if (clean && clean.toLowerCase() !== 'none') {
          allergenSet.add(clean);
        }
      }
    }

    if (item.prepTimeMins && item.prepTimeMins > maxPrepTimeMins) {
      maxPrepTimeMins = item.prepTimeMins;
    }
  }

  const reqLower = (dietaryRequirements || '').toLowerCase();
  const requiresJainIsolation = breakdown.Jain > 0 || reqLower.includes('jain');
  const detectedAllergens = Array.from(allergenSet).sort();
  const requiresAllergenIsolation = detectedAllergens.length > 0 || reqLower.includes('allerg') || reqLower.includes('nut');

  const chafingCount = Math.max(4, Math.ceil(Math.max(items.length, packageIncludedItems.length, 4) * Math.max(1, guestCount / 80)));
  const equipmentChecklist = [
    `${chafingCount} x Brass/SS Chafing Dishes with Induction/Fuel Warmers`,
    `${Math.max(2, Math.ceil(guestCount / 50))} x Insulated Thermal Food Carriers (Cambro)`,
    `${Math.max(20, Math.round(guestCount * 1.15))} x Biodegradable / Porcelain Dining Sets`,
    ...(requiresJainIsolation ? ['Dedicated Green-Labelled Jain Prep & Serving Utensils (Zero Onion/Garlic Zone)'] : []),
    ...(requiresAllergenIsolation
      ? [`Allergen Signage Cards (${detectedAllergens.length ? detectedAllergens.join(', ') : 'Custom Restrictions'})`]
      : []),
    'FSSAI Food Temperature Probe & Hygiene Gloves Kit',
  ];

  return {
    totalPortions: totalPortions || guestCount,
    dietaryBreakdown: breakdown,
    detectedAllergens,
    requiresJainIsolation,
    requiresAllergenIsolation,
    maxPrepTimeMins,
    equipmentChecklist,
  };
}
