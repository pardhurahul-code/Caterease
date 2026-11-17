import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { foodCategories, foodItems, cateringPackages, cateringServices } from '../../db/schema.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

function slugify(str: string) {
  return (
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Math.floor(100 + Math.random() * 900)
  );
}

// Public Categories
router.get('/categories', async (_req, res) => {
  try {
    const rows = await db.select().from(foodCategories).orderBy(asc(foodCategories.displayOrder), asc(foodCategories.name));
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Fetch categories error:', err);
    res.status(500).json({ success: false, message: 'Failed to load food categories.' });
  }
});

router.post('/categories', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(60),
      description: z.string().max(300).optional(),
      displayOrder: z.number().int().optional(),
      imageUrl: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const [created] = await db
      .insert(foodCategories)
      .values({
        name: parsed.data.name.trim(),
        slug: slugify(parsed.data.name),
        description: parsed.data.description || '',
        displayOrder: parsed.data.displayOrder ?? 10,
        imageUrl: parsed.data.imageUrl || '/src/assets/images/dish_royal_biryani_1794926255654.jpg',
      })
      .returning();
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ success: false, message: 'Failed to create category.' });
  }
});

router.delete('/categories/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.delete(foodCategories).where(eq(foodCategories.id, Number(req.params.id)));
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(400).json({ success: false, message: 'Cannot delete category that still contains food items.' });
  }
});

// Public Food Catalog with search, filters, sorting
router.get('/catalog', async (req, res) => {
  try {
    const { search, category, dietary, glutenFree, featured, includeUnavailable } = req.query;
    const conditions = [];

    if (includeUnavailable !== 'true') {
      conditions.push(eq(foodItems.isAvailable, true));
    }
    if (category && category !== 'All') {
      conditions.push(eq(foodCategories.slug, String(category).toLowerCase()));
    }
    if (dietary && dietary !== 'All') {
      conditions.push(eq(foodItems.dietaryType, String(dietary)));
    }
    if (glutenFree === 'true') {
      conditions.push(eq(foodItems.isGlutenFree, true));
    }
    if (featured === 'true') {
      conditions.push(eq(foodItems.isFeatured, true));
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      conditions.push(or(ilike(foodItems.name, q), ilike(foodItems.description, q), ilike(foodItems.ingredients, q)));
    }

    const rows = await db
      .select({
        id: foodItems.id,
        categoryId: foodItems.categoryId,
        categoryName: foodCategories.name,
        categorySlug: foodCategories.slug,
        name: foodItems.name,
        slug: foodItems.slug,
        description: foodItems.description,
        price: foodItems.price,
        unit: foodItems.unit,
        dietaryType: foodItems.dietaryType,
        isGlutenFree: foodItems.isGlutenFree,
        isAvailable: foodItems.isAvailable,
        ingredients: foodItems.ingredients,
        allergens: foodItems.allergens,
        prepTimeMins: foodItems.prepTimeMins,
        calories: foodItems.calories,
        imageUrl: foodItems.imageUrl,
        isFeatured: foodItems.isFeatured,
      })
      .from(foodItems)
      .innerJoin(foodCategories, eq(foodItems.categoryId, foodCategories.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(foodItems.isFeatured), asc(foodItems.name));

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Fetch catalog error:', err);
    res.status(500).json({ success: false, message: 'Failed to load food catalog.' });
  }
});

const foodItemSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(2).max(120),
  description: z.string().min(5).max(500),
  price: z.number().nonnegative(),
  unit: z.string().min(1).max(30).default('per plate'),
  dietaryType: z.enum(['Veg', 'Non-Veg', 'Vegan', 'Jain']).default('Veg'),
  isGlutenFree: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  ingredients: z.string().min(2).max(400),
  allergens: z.string().max(200).default('None'),
  prepTimeMins: z.number().int().positive().default(40),
  calories: z.number().int().nonnegative().default(320),
  imageUrl: z.string().optional(),
  isFeatured: z.boolean().default(false),
});

router.post('/catalog', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const parsed = foodItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const [created] = await db
      .insert(foodItems)
      .values({
        ...parsed.data,
        price: parsed.data.price.toFixed(2),
        slug: slugify(parsed.data.name),
        imageUrl: parsed.data.imageUrl || '/src/assets/images/dish_royal_biryani_1794926255654.jpg',
      })
      .returning();
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create food item error:', err);
    res.status(500).json({ success: false, message: 'Failed to create food item.' });
  }
});

router.put('/catalog/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const parsed = foodItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const updates: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.price !== undefined) updates.price = parsed.data.price.toFixed(2);

    const [updated] = await db.update(foodItems).set(updates).where(eq(foodItems.id, Number(req.params.id))).returning();
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update food item error:', err);
    res.status(500).json({ success: false, message: 'Failed to update food item.' });
  }
});

router.delete('/catalog/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.delete(foodItems).where(eq(foodItems.id, Number(req.params.id)));
    res.json({ success: true, message: 'Food item deleted.' });
  } catch (err) {
    console.error('Delete food item error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete food item.' });
  }
});

// Services & Catering Packages
router.get('/services', async (_req, res) => {
  try {
    const rows = await db.select().from(cateringServices).where(eq(cateringServices.isActive, true));
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Services error:', err);
    res.status(500).json({ success: false, message: 'Failed to load catering services.' });
  }
});

router.get('/packages', async (req, res) => {
  try {
    const { eventType, search } = req.query;
    const conditions = [];
    if (eventType && eventType !== 'All') {
      conditions.push(eq(cateringPackages.eventType, String(eventType)));
    }
    if (search && String(search).trim()) {
      const q = `%${String(search).trim()}%`;
      conditions.push(or(ilike(cateringPackages.name, q), ilike(cateringPackages.description, q)));
    }
    const rows = await db
      .select()
      .from(cateringPackages)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(cateringPackages.isFeatured), asc(cateringPackages.pricePerPerson));

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Fetch packages error:', err);
    res.status(500).json({ success: false, message: 'Failed to load catering packages.' });
  }
});

const packageSchema = z.object({
  name: z.string().min(2).max(120),
  eventType: z.string().min(2).max(60),
  description: z.string().min(5).max(500),
  pricePerPerson: z.number().positive(),
  minGuests: z.number().int().positive().default(25),
  maxGuests: z.number().int().positive().default(1500),
  includedItemsJson: z.array(z.string()).default([]),
  customizationOptionsJson: z.array(z.string()).default([]),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

router.post('/packages', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const parsed = packageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const [created] = await db
      .insert(cateringPackages)
      .values({
        ...parsed.data,
        pricePerPerson: parsed.data.pricePerPerson.toFixed(2),
        slug: slugify(parsed.data.name),
        imageUrl: parsed.data.imageUrl || '/src/assets/images/hero_catering_banquet_1794926254985.jpg',
      })
      .returning();
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Create package error:', err);
    res.status(500).json({ success: false, message: 'Failed to create catering package.' });
  }
});

router.put('/packages/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const parsed = packageSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message });

    const updates: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.pricePerPerson !== undefined) updates.pricePerPerson = parsed.data.pricePerPerson.toFixed(2);

    const [updated] = await db
      .update(cateringPackages)
      .set(updates)
      .where(eq(cateringPackages.id, Number(req.params.id)))
      .returning();
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update package error:', err);
    res.status(500).json({ success: false, message: 'Failed to update package.' });
  }
});

router.delete('/packages/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await db.delete(cateringPackages).where(eq(cateringPackages.id, Number(req.params.id)));
    res.json({ success: true, message: 'Package deleted.' });
  } catch (err) {
    console.error('Delete package error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete package.' });
  }
});

export default router;
