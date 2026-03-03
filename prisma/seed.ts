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
  const coffee = await prisma.category.create({
    data: { name: 'Coffee', slug: 'coffee', icon: '☕', sortOrder: 1 },
  });
  const nonCoffee = await prisma.category.create({
    data: { name: 'Non-Coffee', slug: 'non-coffee', icon: '🍵', sortOrder: 2 },
  });
  const pastry = await prisma.category.create({
    data: { name: 'Pastry', slug: 'pastry', icon: '🥐', sortOrder: 3 },
  });
  const addOns = await prisma.category.create({
    data: { name: 'Add-ons', slug: 'add-ons', icon: '✨', sortOrder: 4 },
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

  // Coffee menu items
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
        categoryId: coffee.id,
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

  // Non-coffee menu items
  const nonCoffeeItems = [
    { name: 'Matcha Latte', description: 'Premium Japanese matcha with steamed milk', price: 30000, isBestSeller: true, isRecommended: true, type: 'both' },
    { name: 'Taro Latte', description: 'Creamy taro with steamed milk', price: 28000, type: 'both' },
    { name: 'Chocolate', description: 'Rich Belgian chocolate with steamed milk', price: 28000, type: 'both' },
    { name: 'Strawberry Milk', description: 'Fresh strawberry blended with cold milk', price: 26000, type: 'iced' },
    { name: 'Thai Tea', description: 'Classic Thai tea with creamy condensed milk', price: 24000, isBestSeller: true, type: 'iced' },
    { name: 'Lemon Tea', description: 'Refreshing black tea with fresh lemon', price: 20000, type: 'both' },
    { name: 'Mango Smoothie', description: 'Tropical mango blended with yogurt', price: 30000, isRecommended: true, type: 'iced' },
  ];

  for (const item of nonCoffeeItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: nonCoffee.id,
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

  // Pastry menu items
  const pastryItems = [
    { name: 'Croissant', description: 'Buttery, flaky French pastry', price: 22000, isBestSeller: true, type: 'hot' },
    { name: 'Chocolate Muffin', description: 'Rich chocolate muffin with chocolate chips', price: 20000, type: 'hot' },
    { name: 'Banana Bread', description: 'Moist banana bread with walnuts', price: 18000, isRecommended: true, type: 'hot' },
    { name: 'Cheese Cake', description: 'Classic New York style cheesecake', price: 28000, isBestSeller: true, type: 'hot' },
    { name: 'Cookie', description: 'Crunchy chocolate chip cookie', price: 15000, type: 'hot' },
    { name: 'Danish Pastry', description: 'Fruit-topped danish pastry', price: 25000, type: 'hot' },
  ];

  for (const item of pastryItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: pastry.id,
        isRecommended: item.isRecommended ?? false,
      },
    });
  }

  // Add-on items
  const addOnItems = [
    { name: 'Extra Espresso Shot', description: 'Add an extra shot of espresso', price: 8000, type: 'hot' },
    { name: 'Oat Milk', description: 'Switch to premium oat milk', price: 6000, type: 'both' },
    { name: 'Almond Milk', description: 'Switch to almond milk', price: 6000, type: 'both' },
  ];

  for (const item of addOnItems) {
    await prisma.menuItem.create({
      data: {
        ...item,
        categoryId: addOns.id,
      },
    });
  }

  console.log('✅ Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
