import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { slugify } from '../common/utils/slugify';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(dto: CreateProductDto) {
    const slug = slugify(dto.name);

    const existingSlug = await this.prisma.product.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      throw new ConflictException('Ya existe un producto con ese nombre');
    }

    const skus = dto.variants.map((v) => v.sku);
    const existingSkus = await this.prisma.productVariant.findMany({
      where: { sku: { in: skus } },
      select: { sku: true },
    });

    if (existingSkus.length > 0) {
      const duplicated = existingSkus.map((v) => v.sku).join(', ');
      throw new ConflictException(`SKU(s) ya en uso: ${duplicated}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          categoryId: dto.categoryId,
        },
      });

      for (const variant of dto.variants) {
        const createdVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: variant.sku,
            attributes: variant.attributes,
            price: variant.price,
            stock: variant.initialStock ?? 0,
          },
        });

        if (variant.initialStock && variant.initialStock > 0) {
          await tx.inventoryMovement.create({
            data: {
              variantId: createdVariant.id,
              type: 'IN',
              quantity: variant.initialStock,
              reason: 'Stock inicial al crear producto',
            },
          });
        }
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: { variants: true, category: true, images: true },
      });
    });

    await this.invalidateProductsCache();
    return result;
  }

  async findAll(categoryId?: string) {
    const cacheKey = `products:all:${categoryId ?? 'no-category'}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: true,
        variants: true,
        images: { orderBy: { order: 'asc' } },
      },
    });

    await this.cacheManager.set(cacheKey, products, 60000);
    return products;
  }

  async findOne(id: string) {
    const cacheKey = `products:one:${id}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
        images: { orderBy: { order: 'asc' } },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    await this.cacheManager.set(cacheKey, product, 60000);
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    const data: any = { ...dto };
    if (dto.name) {
      data.slug = slugify(dto.name);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data,
    });

    await this.invalidateProductsCache();
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    const removed = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await this.invalidateProductsCache();
    return removed;
  }

  private async invalidateProductsCache() {
    const store: any = (this.cacheManager as any).store;
    if (store?.client?.keys) {
      const keys = await store.client.keys('products:*');
      if (keys.length > 0) {
        await store.client.del(keys);
      }
    }
  }
}
