import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKitchenComplianceMatrix } from './kitchenSheet';

test('computes dietary breakdown, allergen flags, and Jain isolation checklist', () => {
  const matrix = buildKitchenComplianceMatrix(
    [
      { itemName: 'Jain Paneer Tikka', quantity: 50, dietaryType: 'Jain', allergens: 'Dairy', prepTimeMins: 40 },
      { itemName: 'Saffron Dum Biryani', quantity: 100, dietaryType: 'Veg', allergens: 'Dairy, Cashew Nuts', prepTimeMins: 75 },
      { itemName: 'Herb Grilled Chicken', quantity: 60, dietaryType: 'Non-Veg', allergens: 'None', prepTimeMins: 55 },
    ],
    120,
    [],
    'Separate Jain counter and nut-free tags'
  );

  assert.equal(matrix.totalPortions, 210);
  assert.equal(matrix.dietaryBreakdown.Jain, 1);
  assert.equal(matrix.dietaryBreakdown.Veg, 1);
  assert.equal(matrix.dietaryBreakdown['Non-Veg'], 1);
  assert.equal(matrix.requiresJainIsolation, true);
  assert.equal(matrix.requiresAllergenIsolation, true);
  assert.deepEqual(matrix.detectedAllergens, ['Cashew Nuts', 'Dairy']);
  assert.equal(matrix.maxPrepTimeMins, 75);
  assert.ok(matrix.equipmentChecklist.some((line) => line.includes('Jain')));
  assert.ok(matrix.equipmentChecklist.some((line) => line.includes('Allergen Signage Cards')));
});
