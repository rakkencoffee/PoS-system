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
  await prisma.topping.createMany({
    data: [
      { name: 'Boba Pearl', price: 5000 },
      { name: 'Cheese Foam', price: 8000 },
      { name: 'Whipped Cream', price: 5000 },
      { name: 'Caramel Drizzle', price: 3000 },
      { name: 'Chocolate Sauce', price: 3000 },
      { name: 'Coconut Jelly', price: 5000 },
      { name: 'Vanilla Syrup', price: 3000 },
    ],
  });

  // ===== COFFEE BASED =====
  const coffeeItems = [
    { name: 'Espresso', description: 'Rich and bold single-origin espresso shot', price: 18000, isBestSeller: true, type: 'hot' },
    { name: 'Americano', description: 'Espresso with hot water for a smooth, rich flavor', price: 22000, isBestSeller: true, type: 'both' },
    { name: 'Cafe Latte', description: 'Creamy espresso with steamed milk and light foam', price: 28000, isBestSeller: true, isRecommended: true, type: 'both' },
    { name: 'Cappuccino', description: 'Equal parts espresso, steamed milk, and foam', price: 28000, isRecommended: true, type: 'both' },
    { name: 'Caramel Macchiato', description: 'Vanilla-flavored latte with caramel drizzle', price: 32000, isBestSeller: true, isRecommended: true, type: 'both' },
    { name: 'Mocha', description: 'Espresso with chocolate and steamed milk', price: 32000, type: 'both' },
    { name: 'Flat White', description: 'Double shot espresso with velvety micro-foam milk', price: 30000, type: 'hot' },
    { name: 'Affogato', description: 'Vanilla ice cream drowned in a shot of espresso', price: 35000, isRecommended: true, type: 'iced' },
    { name: 'Cold Brew', description: 'Slow-steeped for 20 hours, smooth and refreshing', price: 28000, isBestSeller: true, type: 'iced' },
    { name: 'Vanilla Latte', description: 'Classic latte with premium vanilla syrup', price: 30000, type: 'both' },
  ];

  for (const item of coffeeItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: coffeeBased.id,
        isRecommended: item.isRecommended ?? false,
        sizes: {
          create: [
            { size: 'S', priceAdjustment: -4000 },
            { size: 'M', priceAdjustment: 0 },
            { size: 'L', priceAdjustment: 6000 },
          ],
        },
      },
    });
  }

  // ===== MILK BASED =====
  const milkItems = [
    { name: 'Matcha Latte', description: 'Premium Japanese matcha with steamed milk', price: 30000, isBestSeller: true, isRecommended: true, type: 'both' },
    { name: 'Taro Latte', description: 'Creamy taro with steamed milk', price: 28000, type: 'both' },
    { name: 'Chocolate', description: 'Rich Belgian chocolate with steamed milk', price: 28000, type: 'both' },
    { name: 'Strawberry Milk', description: 'Fresh strawberry blended with cold milk', price: 26000, type: 'iced' },
    { name: 'Thai Tea', description: 'Classic Thai tea with creamy condensed milk', price: 24000, isBestSeller: true, type: 'iced' },
    { name: 'Mango Smoothie', description: 'Tropical mango blended with yogurt', price: 30000, isRecommended: true, type: 'iced' },
    { name: 'Oat Milk Latte', description: 'Smooth latte with premium oat milk', price: 30000, type: 'both' },
  ];

  for (const item of milkItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: milkBased.id,
        isRecommended: item.isRecommended ?? false,
        sizes: {
          create: [
            { size: 'S', priceAdjustment: -4000 },
            { size: 'M', priceAdjustment: 0 },
            { size: 'L', priceAdjustment: 6000 },
          ],
        },
      },
    });
  }

  // ===== MAIN COURSE =====
  // Placeholder — user can add via admin panel
  const mainCourseItems = [
    { name: 'Nasi Goreng Rakken', description: 'Signature fried rice with special seasoning', price: 35000, isBestSeller: true, type: 'hot' as const },
    { name: 'Indomie Goreng Special', description: 'Indomie goreng with egg and toppings', price: 25000, type: 'hot' as const },
    { name: 'Roti Bakar', description: 'Toasted bread with various toppings', price: 20000, type: 'hot' as const },
  ];

  for (const item of mainCourseItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: mainCourse.id,
        isRecommended: false,
      },
    });
  }

  // ===== DESSERT =====
  const dessertItems = [
    { name: 'Banana Fritter Ice Cream', description: 'Pisang goreng tipis, vanilla ice cream, drizzle gula aren / caramel', price: 30000, isRecommended: true, type: 'both' },
    { name: 'Rakken Cereal Ice Cream Bowl', description: 'Vanilla ice cream, honey cornflakes/cereal, sedikit caramel / cokelat drizzle', price: 32000, isBestSeller: true, type: 'iced' },
    { name: 'Matcha Ice Cream Parfait', description: 'Matcha ice cream, granola/cereal, sedikit red bean jelly opsional, cup', price: 35000, isRecommended: true, type: 'iced' },
    { name: 'Japanese Caramel Pudding', description: 'Kuning telur, susu/cream manis, caramel di dasar cup (purin style)', price: 25000, isBestSeller: true, type: 'both' },
    { name: 'Matcha Pudding Cup', description: 'Puding matcha lembut, topping cream tipis', price: 22000, type: 'both' },
    { name: 'Vanilla Yogurt Parfait', description: 'Yogurt, granola, buah (strawberry/mango)', price: 28000, isRecommended: true, type: 'iced' },
    { name: 'Choco Chip Muffin', description: 'Muffin cokelat/choco chip, supply bakery', price: 18000, type: 'hot' },
    { name: 'Almond Croissant', description: 'Croissant almond manis, cocok teman kopi', price: 25000, type: 'hot' },
  ];

  for (const item of dessertItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: dessert.id,
        isRecommended: item.isRecommended ?? false,
      },
    });
  }

  // ===== SNACK =====
  const snackItems = [
    { name: 'Banana Fritter Palm Sugar', description: 'Pisang goreng tipis, gula aren & sedikit keju', price: 18000, type: 'hot' },
    { name: 'Garlic Seasoned Fries', description: 'Kentang goreng dengan bumbu garlic/herbs', price: 22000, isBestSeller: true, type: 'hot' },
    { name: 'Chicken Karaage Bites', description: 'Ayam karaage frozen, saus mayo / spicy mayo', price: 28000, isBestSeller: true, isRecommended: true, type: 'hot' },
    { name: 'Gyoza Platter', description: 'Gyoza ayam/frozen, pan-fry/steam, saus shoyu-sesame', price: 25000, isRecommended: true, type: 'hot' },
    { name: 'Nori Seaweed Crisps', description: 'Nori goreng tepung crispy', price: 15000, type: 'hot' },
    { name: 'Fried Enoki', description: 'Enoki goreng tepung dengan bumbu', price: 18000, type: 'hot' },
    { name: 'Rakken Oden Bowl', description: 'Chikuwa, satsuma-age, hanpen dalam light dashi–shoyu broth', price: 30000, isRecommended: true, type: 'hot' },
    { name: 'Sausage Bites Platter', description: 'Sosis potong kecil, digoreng/grill, saus mayo & chilli', price: 20000, type: 'hot' },
    { name: 'Cimol RAKKEN', description: 'Cimol goreng dengan bumbu pedas gurih', price: 15000, isBestSeller: true, type: 'hot' },
    { name: 'Cireng Bumbu Rujak', description: 'Cireng frozen, digoreng, bumbu rujak siap pakai', price: 15000, type: 'hot' },
    { name: 'RAKKEN Mixed Snack Platter', description: 'Mix: fries + karaage + gyoza/cireng (sharing 2–3 orang)', price: 45000, isBestSeller: true, isRecommended: true, type: 'hot' },
  ];

  for (const item of snackItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: snack.id,
        isRecommended: item.isRecommended ?? false,
      },
    });
  }

  // ===== REFRESHMENT =====
  const refreshmentItems = [
    { name: 'Jasmine Green Tea', description: 'Jasmine green tea, light sugar', price: 18000, type: 'both' },
    { name: 'Lychee Tea', description: 'Black/green tea, lychee syrup, lychee fruit, ice', price: 22000, isBestSeller: true, isRecommended: true, type: 'iced' },
    { name: 'Lemon Black Tea', description: 'Black tea, lemon, sugar/honey', price: 20000, type: 'both' },
    { name: 'Hibiscus Berry Tea', description: 'Hibiscus + berry infusion, sugar/honey, ice', price: 24000, isRecommended: true, type: 'iced' },
    { name: 'Citrus Yakult Fizz', description: 'Yakult, citrus syrup, soda/water, ice', price: 22000, isBestSeller: true, type: 'iced' },
    { name: 'Lychee Mojito Spritz', description: 'Chocolate drink, caramel syrup, pinch sea salt', price: 25000, type: 'iced' },
  ];

  for (const item of refreshmentItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: refreshment.id,
        isRecommended: item.isRecommended ?? false,
        sizes: {
          create: [
            { size: 'S', priceAdjustment: -4000 },
            { size: 'M', priceAdjustment: 0 },
            { size: 'L', priceAdjustment: 6000 },
          ],
        },
      },
    });
  }

  console.log('✅ Seed data created successfully!');
  console.log('Categories: COFFEE BASED, MILK BASED, MAIN COURSE, DESSERT, Snack, Refreshment');
  console.log(`Menu items: ${coffeeItems.length + milkItems.length + mainCourseItems.length + dessertItems.length + snackItems.length + refreshmentItems.length} total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
