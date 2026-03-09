import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.orderItemTopping.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItemSize.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.topping.deleteMany();
  await prisma.category.deleteMany();

  // Create categories
  const coffeeBased = await prisma.category.create({
    data: { name: 'COFFEE BASED', slug: 'coffee-based', icon: '☕', sortOrder: 1 },
  });
  const milkBased = await prisma.category.create({
    data: { name: 'MILK BASED', slug: 'milk-based', icon: '🥛', sortOrder: 2 },
  });
  const mainCourse = await prisma.category.create({
    data: { name: 'MAIN COURSE', slug: 'main-course', icon: '🍽️', sortOrder: 3 },
  });
  const dessert = await prisma.category.create({
    data: { name: 'DESSERT', slug: 'dessert', icon: '🍰', sortOrder: 4 },
  });
  const snack = await prisma.category.create({
    data: { name: 'Snack', slug: 'snack', icon: '🍟', sortOrder: 5 },
  });
  const refreshment = await prisma.category.create({
    data: { name: 'Refreshment', slug: 'refreshment', icon: '🧃', sortOrder: 6 },
  });

  // Create toppings
  // Optional Choices (replaces old toppings — only for Coffee & Milk based)
  await prisma.topping.createMany({
    data: [
      { name: 'Almond Milk', price: 6000 },
      { name: 'Espresso Shot', price: 6000 },
      { name: 'Whip Cream', price: 6000 },
    ],
  });

  // Helper: create sizes for drink items
  // Sizes now use Hot / Ice / Upsize (each optional)
  type SizeDef = { size: string; priceAdjustment: number };

  // ===== COFFEE BASED =====
  const coffeeItems: {
    name: string; description: string; price: number;
    isBestSeller?: boolean; isRecommended?: boolean; type: string;
    sizes: SizeDef[];
  }[] = [
    // --- Bottled/Canned (no size variants) ---
    { name: 'RAKKEN Canned Black', description: 'Cold brew bottled coffee (espresso)', price: 25000, type: 'iced', sizes: [] },
    { name: 'RAKKEN Canned White Latte', description: 'Cold brew bottled coffee latte (espresso, milk)', price: 28000, type: 'iced', sizes: [] },
    { name: 'RAKKEN Bottled Rose Latte', description: 'Cold brew bottled coffee latte (espresso, milk, rose syrup)', price: 30000, isRecommended: true, type: 'iced', sizes: [] },
    { name: 'RAKKEN Bottled Coconut Latte', description: 'Cold brew bottled coffee latte (espresso, coconut milk)', price: 30000, type: 'iced', sizes: [] },
    // --- Classic Coffee ---
    { name: 'Espresso', description: 'Espresso single shot', price: 18000, type: 'hot',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }] },
    { name: 'Americano', description: 'Espresso, water', price: 22000, isBestSeller: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Caffè Latte', description: 'Espresso, fresh milk', price: 28000, isBestSeller: true, isRecommended: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Cappuccino', description: 'Espresso, steamed milk, milk foam', price: 28000, isRecommended: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Aren Latte', description: 'Espresso, fresh milk, palm sugar syrup (aren)', price: 28000, isBestSeller: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Caramel Latte', description: 'Espresso, milk, caramel syrup', price: 30000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Hazelnut Latte', description: 'Espresso, milk, hazelnut syrup', price: 30000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Pandan Latte', description: 'Espresso, milk, pandan syrup', price: 30000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Salted Caramel Latte', description: 'Espresso, milk, caramel syrup, pinch of sea salt', price: 32000, isRecommended: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'RAKKEN House Blend', description: 'Espresso, milk, blend aren + caramel light', price: 30000, isBestSeller: true, isRecommended: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    // --- Cloud Series ---
    { name: 'Butterscotch Coffee Cloud', description: 'Espresso, milk, butterscotch syrup, cream foam', price: 32000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Pistachio Latte Cloud', description: 'Espresso, milk, pistachio flavour, cream foam, crumble ringan', price: 35000, isRecommended: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Mocha Coffee Cloud', description: 'Espresso, milk, chocolate sauce, cream foam', price: 32000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    // --- Iced / Specialty ---
    { name: 'Citrus Summer Coffee', description: 'Espresso, orange/lemon juice, simple syrup, soda/water, ice', price: 30000, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Apple Black Coffee', description: 'Espresso/strong coffee, yuzu/citrus syrup, soda/water, ice', price: 30000, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    // --- Ice Blend ---
    { name: 'RAKKEN Coffee Ice Blend', description: 'Espresso, fresh milk, simple syrup, ice blend, whipped/cream optional', price: 32000, isBestSeller: true, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Caramel Coffee Ice Blend', description: 'Espresso, fresh milk, caramel syrup, ice blend, whipped/cream optional', price: 32000, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    // --- Sampler ---
    { name: 'RAKKEN Coffee Sampler', description: '5 jenis kopi mini-sized (100 ml)', price: 65000, isRecommended: true, type: 'iced', sizes: [] },
  ];

  for (const item of coffeeItems) {
    const { sizes, ...itemData } = item;
    await prisma.menuItem.create({
      data: {
        ...itemData,
        categoryId: coffeeBased.id,
        isRecommended: itemData.isRecommended ?? false,
        isBestSeller: itemData.isBestSeller ?? false,
        sizes: sizes.length > 0 ? { create: sizes } : undefined,
      },
    });
  }

  // ===== MILK BASED =====
  const milkItems: typeof coffeeItems = [
    { name: 'Kyoto Latte', description: 'Matcha powder, milk, sweetener simple', price: 28000, isBestSeller: true, isRecommended: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Matcha Cream Cloud', description: 'Matcha latte base, cream/foam "cloud", sedikit crumble', price: 32000, isRecommended: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Matcha Aren Latte', description: 'Matcha, milk, palm sugar syrup (aren)', price: 30000, isBestSeller: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Matcha Berry Latte', description: 'Matcha latte, berry/strawberry syrup, milk', price: 32000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Dark Chocolate', description: 'Cocoa/chocolate sauce, milk', price: 26000, isBestSeller: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Sea Salt Caramel Chocolate', description: 'Chocolate drink, caramel syrup, pinch sea salt', price: 30000, isRecommended: true, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Almond Chocolate', description: 'Chocolate drink, almond syrup/milk', price: 30000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Vanilla Malt Milk', description: 'Vanilla + malt powder, milk', price: 26000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    // --- Ice Blend ---
    { name: 'Matcha Blended Cream', description: 'Matcha powder, milk, ice blend, sweetener, whipped/cream on top', price: 32000, isBestSeller: true, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Dark Chocolate Ice Blend', description: 'Chocolate sauce, milk, ice blend, whipped/cream optional', price: 32000, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Vanilla Malt Crunch Ice Blend', description: 'Vanilla & malt powder, milk, ice blend, sedikit crumble/topping', price: 32000, isRecommended: true, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
  ];

  for (const item of milkItems) {
    const { sizes, ...itemData } = item;
    await prisma.menuItem.create({
      data: {
        ...itemData,
        categoryId: milkBased.id,
        isRecommended: itemData.isRecommended ?? false,
        isBestSeller: itemData.isBestSeller ?? false,
        sizes: sizes.length > 0 ? { create: sizes } : undefined,
      },
    });
  }

  // ===== MAIN COURSE (no type, no sizes) =====
  const mainCourseItems = [
    { name: 'Baked Chicken/Tuna/Salmon Creamy Mash', description: 'Mashed potato + chicken/tuna/salmon (garlic, pepper) + keju tipis', price: 42000, isBestSeller: true, isRecommended: true },
    { name: 'Sambal Cream Chicken/Salmon Mash Bake', description: 'Mashed potato + ayam/salmon suwir + sambal+mayo + keju tipis', price: 42000, isRecommended: true },
    { name: 'Chicken/Salmon Mentai Rice Bake', description: 'Nasi + ayam/salmon crispy + saus mentai + keju tipis', price: 40000, isBestSeller: true },
    { name: 'Karaage Garlic Potato Bake', description: 'Kentang dadu + garlic butter + keju + chicken karaage', price: 38000, isBestSeller: true },
    { name: 'Corn Butter Rice Gratin', description: 'Nasi + jagung manis + butter + sedikit cream/keju', price: 35000 },
    { name: 'Karaage Sambal Matah Bowl', description: 'Nasi + karaage + sambal matah ringan + lalapan', price: 38000, isRecommended: true },
    { name: 'Honey Butter Chicken Rice Bowl', description: 'Nasi + ayam tumis madu + butter + garlic + wijen', price: 38000, isBestSeller: true },
    { name: 'Teriyaki Corn Butter Rice Bowl', description: 'Nasi + ayam teriyaki + jagung butter + nori', price: 38000 },
    { name: 'Chicken/Tuna/Salmon Mayo Onigiri Plate', description: 'Onigiri + chicken/tuna/salmon mayo + salad hijau + pickles', price: 35000, isRecommended: true },
  ];

  for (const item of mainCourseItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: mainCourse.id,
        type: 'none',
        isRecommended: item.isRecommended ?? false,
        isBestSeller: item.isBestSeller ?? false,
      },
    });
  }

  // ===== DESSERT (no type, no sizes) =====
  const dessertItems = [
    { name: 'Banana Fritter Ice Cream', description: 'Pisang goreng tipis, vanilla ice cream, drizzle gula aren / caramel', price: 30000, isRecommended: true },
    { name: 'Rakken Cereal Ice Cream Bowl', description: 'Vanilla ice cream, honey cornflakes/cereal, sedikit caramel / cokelat drizzle', price: 32000, isBestSeller: true },
    { name: 'Matcha Ice Cream Parfait', description: 'Matcha ice cream, granola/cereal, sedikit red bean jelly opsional, cup', price: 35000, isRecommended: true },
    { name: 'Japanese Caramel Pudding', description: 'Kuning telur, susu/cream manis, caramel di dasar cup (purin style)', price: 25000, isBestSeller: true },
    { name: 'Matcha Pudding Cup', description: 'Puding matcha lembut, topping cream tipis', price: 22000 },
    { name: 'Vanilla Yogurt Parfait', description: 'Yogurt, granola, buah (strawberry/mango)', price: 28000, isRecommended: true },
    { name: 'Choco Chip Muffin', description: 'Muffin cokelat/choco chip, supply bakery', price: 18000 },
    { name: 'Almond Croissant', description: 'Croissant almond manis, cocok teman kopi', price: 25000 },
  ];

  for (const item of dessertItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: dessert.id,
        type: 'none',
        isRecommended: item.isRecommended ?? false,
        isBestSeller: item.isBestSeller ?? false,
      },
    });
  }

  // ===== SNACK (no type, no sizes) =====
  const snackItems = [
    { name: 'Banana Fritter Palm Sugar', description: 'Pisang goreng tipis, gula aren & sedikit keju', price: 18000 },
    { name: 'Garlic Seasoned Fries', description: 'Kentang goreng dengan bumbu garlic/herbs', price: 22000, isBestSeller: true },
    { name: 'Chicken Karaage Bites', description: 'Ayam karaage frozen, saus mayo / spicy mayo', price: 28000, isBestSeller: true, isRecommended: true },
    { name: 'Gyoza Platter', description: 'Gyoza ayam/frozen, pan-fry/steam, saus shoyu-sesame', price: 25000, isRecommended: true },
    { name: 'Nori Seaweed Crisps', description: 'Nori goreng tepung crispy', price: 15000 },
    { name: 'Fried Enoki', description: 'Enoki goreng tepung dengan bumbu', price: 18000 },
    { name: 'Rakken Oden Bowl', description: 'Chikuwa, satsuma-age, hanpen dalam light dashi–shoyu broth', price: 30000, isRecommended: true },
    { name: 'Sausage Bites Platter', description: 'Sosis potong kecil, digoreng/grill, saus mayo & chilli', price: 20000 },
    { name: 'Cimol RAKKEN', description: 'Cimol goreng dengan bumbu pedas gurih', price: 15000, isBestSeller: true },
    { name: 'Cireng Bumbu Rujak', description: 'Cireng frozen, digoreng, bumbu rujak siap pakai', price: 15000 },
    { name: 'RAKKEN Mixed Snack Platter', description: 'Mix: fries + karaage + gyoza/cireng (sharing 2–3 orang)', price: 45000, isBestSeller: true, isRecommended: true },
  ];

  for (const item of snackItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: snack.id,
        type: 'none',
        isRecommended: item.isRecommended ?? false,
        isBestSeller: item.isBestSeller ?? false,
      },
    });
  }

  // ===== REFRESHMENT (with Hot/Ice/Upsize) =====
  const refreshmentItems: typeof coffeeItems = [
    { name: 'Jasmine Green Tea', description: 'Jasmine green tea, light sugar', price: 18000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Lychee Tea', description: 'Black/green tea, lychee syrup, lychee fruit, ice', price: 22000, isBestSeller: true, isRecommended: true, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Lemon Black Tea', description: 'Black tea, lemon, sugar/honey', price: 20000, type: 'both',
      sizes: [{ size: 'Hot', priceAdjustment: 0 }, { size: 'Ice', priceAdjustment: 2000 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Hibiscus Berry Tea', description: 'Hibiscus + berry infusion, sugar/honey, ice', price: 24000, isRecommended: true, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Citrus Yakult Fizz', description: 'Yakult, citrus syrup, soda/water, ice', price: 22000, isBestSeller: true, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
    { name: 'Lychee Mojito Spritz', description: 'Chocolate drink, caramel syrup, pinch sea salt', price: 25000, type: 'iced',
      sizes: [{ size: 'Ice', priceAdjustment: 0 }, { size: 'Upsize', priceAdjustment: 5000 }] },
  ];

  for (const item of refreshmentItems) {
    const { sizes, ...itemData } = item;
    await prisma.menuItem.create({
      data: {
        ...itemData,
        categoryId: refreshment.id,
        isRecommended: itemData.isRecommended ?? false,
        isBestSeller: itemData.isBestSeller ?? false,
        sizes: { create: sizes },
      },
    });
  }

  const totalItems = coffeeItems.length + milkItems.length + mainCourseItems.length + dessertItems.length + snackItems.length + refreshmentItems.length;
  console.log('✅ Seed data created successfully!');
  console.log('Categories: COFFEE BASED, MILK BASED, MAIN COURSE, DESSERT, Snack, Refreshment');
  console.log(`Menu items: ${totalItems} total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
