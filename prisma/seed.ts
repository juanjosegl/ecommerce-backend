import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function productImage(unsplashId: string): string {
  return `https://images.unsplash.com/photo-${unsplashId}?w=800&h=800&fit=crop&q=80`;
}

async function seedAdmin() {
  const adminEmail = 'admin@ecommerce.com';
  const adminPassword = 'CambiaEstaClave123!';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('El usuario admin ya existe.');
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Principal',
      role: 'ADMIN',
      provider: 'LOCAL',
    },
  });

  console.log(`Admin creado: ${adminEmail} / ${adminPassword}`);
}

interface CategorySeed {
  name: string;
  description: string;
  children?: CategorySeed[];
}

const CATEGORY_TREE: CategorySeed[] = [
  {
    name: 'Ropa',
    description: 'Prendas para vestir a diario, con diseño cuidado.',
    children: [
      {
        name: 'Camisetas',
        description: 'Camisetas de algodón y mezclas premium.',
      },
      {
        name: 'Pantalones',
        description: 'Jeans, cargo y pantalones de vestir casual.',
      },
      {
        name: 'Chaquetas',
        description: 'Chaquetas y abrigos para toda temporada.',
      },
    ],
  },
  {
    name: 'Calzado',
    description: 'Tenis y zapatos para cada estilo.',
    children: [{ name: 'Tenis', description: 'Tenis urbanos y deportivos.' }],
  },
  {
    name: 'Accesorios',
    description: 'Complementos para terminar el look.',
  },
];

async function seedCategories(): Promise<Record<string, string>> {
  const idBySlug: Record<string, string> = {};

  for (const root of CATEGORY_TREE) {
    const rootSlug = slugify(root.name);
    let rootCategory = await prisma.category.findUnique({
      where: { slug: rootSlug },
    });

    if (!rootCategory) {
      rootCategory = await prisma.category.create({
        data: {
          name: root.name,
          slug: rootSlug,
          description: root.description,
        },
      });
    }
    idBySlug[rootSlug] = rootCategory.id;

    for (const child of root.children ?? []) {
      const childSlug = slugify(child.name);
      let childCategory = await prisma.category.findUnique({
        where: { slug: childSlug },
      });

      if (!childCategory) {
        childCategory = await prisma.category.create({
          data: {
            name: child.name,
            slug: childSlug,
            description: child.description,
            parentId: rootCategory.id,
          },
        });
      }
      idBySlug[childSlug] = childCategory.id;
    }
  }

  console.log(`Categorías listas: ${Object.keys(idBySlug).length}`);
  return idBySlug;
}

interface VariantSeed {
  skuSuffix: string;
  size: string;
  color: string;
  priceOverride?: number;
  stock: number;
}

interface ProductSeed {
  name: string;
  description: string;
  categorySlug: string;
  basePrice: number;
  skuPrefix: string;
  unsplashId: string;
  variants: VariantSeed[];
}

const PRODUCTS: ProductSeed[] = [
  {
    name: 'Camiseta Oversize Algodón Orgánico',
    description:
      'Corte relajado y algodón 100% orgánico. Suave al tacto, resistente al lavado y pensada para durar temporadas.',
    categorySlug: 'camisetas',
    basePrice: 65000,
    skuPrefix: 'CAM-OVR',
    unsplashId: '1571455786673-9d9d6c194f90',
    variants: [
      { skuSuffix: 'S-NEG', size: 'S', color: 'Negro', stock: 18 },
      { skuSuffix: 'M-NEG', size: 'M', color: 'Negro', stock: 22 },
      { skuSuffix: 'L-BLA', size: 'L', color: 'Blanco', stock: 15 },
    ],
  },
  {
    name: 'Camiseta Básica Cuello Redondo',
    description:
      'El básico que no puede faltar. Tela de peso medio, cuello reforzado y ajuste clásico para uso diario.',
    categorySlug: 'camisetas',
    basePrice: 45000,
    skuPrefix: 'CAM-BAS',
    unsplashId: '1521572163474-6864f9cf17ab',
    variants: [
      { skuSuffix: 'S-BLA', size: 'S', color: 'Blanco', stock: 30 },
      { skuSuffix: 'M-GRI', size: 'M', color: 'Gris', stock: 25 },
      { skuSuffix: 'L-NEG', size: 'L', color: 'Negro', stock: 20 },
    ],
  },
  {
    name: 'Jean Slim Fit',
    description:
      'Corte slim moderno con un toque de elastano para mayor comodidad. Lavado medio, versátil para cualquier ocasión.',
    categorySlug: 'pantalones',
    basePrice: 120000,
    skuPrefix: 'JEA-SLM',
    unsplashId: '1714143136372-ddaf8b606da7',
    variants: [
      { skuSuffix: '30-AZU', size: '30', color: 'Azul', stock: 12 },
      { skuSuffix: '32-AZU', size: '32', color: 'Azul', stock: 16 },
      { skuSuffix: '34-NEG', size: '34', color: 'Negro', stock: 10 },
    ],
  },
  {
    name: 'Pantalón Cargo Utilitario',
    description:
      'Múltiples bolsillos funcionales y tela resistente. Ajuste relajado, ideal para un estilo urbano y práctico.',
    categorySlug: 'pantalones',
    basePrice: 135000,
    skuPrefix: 'PAN-CAR',
    unsplashId: '1473966968600-fa801b869a1a',
    variants: [
      { skuSuffix: 'M-VER', size: 'M', color: 'Verde', stock: 14 },
      { skuSuffix: 'L-BEI', size: 'L', color: 'Beige', stock: 11 },
    ],
  },
  {
    name: 'Chaqueta Bomber Ligera',
    description:
      'Silueta bomber clásica en versión liviana. Forro interior suave y cierre resistente para uso en entretiempo.',
    categorySlug: 'chaquetas',
    basePrice: 180000,
    skuPrefix: 'CHA-BOM',
    unsplashId: '1591047139829-d91aecb6caea',
    variants: [
      { skuSuffix: 'M-NEG', size: 'M', color: 'Negro', stock: 9 },
      { skuSuffix: 'L-AZU', size: 'L', color: 'Azul', stock: 7 },
    ],
  },
  {
    name: 'Chaqueta de Jean Clásica',
    description:
      'Un básico atemporal. Denim de alta durabilidad con lavado clásico y botones metálicos.',
    categorySlug: 'chaquetas',
    basePrice: 150000,
    skuPrefix: 'CHA-JEA',
    unsplashId: '1611312449408-fcece27cdbb7',
    variants: [
      { skuSuffix: 'S-AZU', size: 'S', color: 'Azul', stock: 8 },
      { skuSuffix: 'M-AZU', size: 'M', color: 'Azul', stock: 13 },
    ],
  },
  {
    name: 'Tenis Urbanos Blancos',
    description:
      'Diseño minimalista que combina con todo. Suela de goma antideslizante y plantilla acolchada.',
    categorySlug: 'tenis',
    basePrice: 210000,
    skuPrefix: 'TEN-URB',
    unsplashId: '1608379743498-ac08f6d022ba',
    variants: [
      { skuSuffix: '39-BLA', size: '39', color: 'Blanco', stock: 10 },
      { skuSuffix: '40-BLA', size: '40', color: 'Blanco', stock: 14 },
      { skuSuffix: '41-BLA', size: '41', color: 'Blanco', stock: 9 },
    ],
  },
  {
    name: 'Tenis Running Performance',
    description:
      'Amortiguación reactiva y malla transpirable. Pensados para largas jornadas de entrenamiento.',
    categorySlug: 'tenis',
    basePrice: 250000,
    skuPrefix: 'TEN-RUN',
    unsplashId: '1560769629-975ec94e6a86',
    variants: [
      { skuSuffix: '40-NEG', size: '40', color: 'Negro', stock: 6 },
      { skuSuffix: '41-GRI', size: '41', color: 'Gris', stock: 8 },
    ],
  },
  {
    name: 'Gorra Snapback',
    description:
      'Ajuste snapback clásico, bordado minimalista al frente. Un accesorio versátil para cualquier outfit.',
    categorySlug: 'accesorios',
    basePrice: 45000,
    skuPrefix: 'ACC-GOR',
    unsplashId: '1737666636073-f15d9762cf83',
    variants: [
      { skuSuffix: 'UNI-NEG', size: 'Única', color: 'Negro', stock: 25 },
    ],
  },
  {
    name: 'Mochila Urbana Impermeable',
    description:
      'Compartimento acolchado para portátil, tela impermeable y diseño compacto para el día a día.',
    categorySlug: 'accesorios',
    basePrice: 95000,
    skuPrefix: 'ACC-MOC',
    unsplashId: '1509762774605-f07235a08f1f',
    variants: [
      { skuSuffix: 'UNI-GRI', size: 'Única', color: 'Gris', stock: 17 },
    ],
  },
];

async function seedProducts(categoryIds: Record<string, string>) {
  let created = 0;
  let skipped = 0;
  let imagesUpdated = 0;

  for (const productSeed of PRODUCTS) {
    const slug = slugify(productSeed.name);
    const existing = await prisma.product.findUnique({ where: { slug } });

    if (existing) {
      // Swap old picsum placeholders for the real photo; admin-uploaded images are left alone.
      const { count } = await prisma.productImage.updateMany({
        where: {
          productId: existing.id,
          url: { startsWith: 'https://picsum.photos/' },
        },
        data: { url: productImage(productSeed.unsplashId) },
      });
      imagesUpdated += count;
      skipped++;
      continue;
    }

    const categoryId = categoryIds[productSeed.categorySlug];
    if (!categoryId) {
      console.warn(
        `Categoría "${productSeed.categorySlug}" no encontrada, se omite "${productSeed.name}"`,
      );
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: productSeed.name,
          slug,
          description: productSeed.description,
          categoryId,
        },
      });

      await tx.productImage.create({
        data: {
          productId: product.id,
          url: productImage(productSeed.unsplashId),
          order: 0,
        },
      });

      for (const variant of productSeed.variants) {
        const createdVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: `${productSeed.skuPrefix}-${variant.skuSuffix}`,
            attributes: { talla: variant.size, color: variant.color },
            price: variant.priceOverride ?? productSeed.basePrice,
            stock: variant.stock,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: createdVariant.id,
            type: 'IN',
            quantity: variant.stock,
            reason: 'Stock inicial (seed de demostración)',
          },
        });
      }
    });

    created++;
  }

  console.log(
    `Productos creados: ${created}, ya existentes: ${skipped}, imágenes actualizadas: ${imagesUpdated}`,
  );
}

async function main() {
  await seedAdmin();
  const categoryIds = await seedCategories();
  await seedProducts(categoryIds);
  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
