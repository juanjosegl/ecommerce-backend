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
import {
  cacheGet,
  cacheSet,
  productsCacheKey,
  invalidateProductsCache,
} from '../common/utils/products-cache';
import { AddVariantDto, UpdateVariantDto } from './dto/manage-variant.dto';
import { AddImageDto } from './dto/manage-image.dto';

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

  async findAll(categoryId?: string, page = 1, limit = 20) {
    page = Number.isFinite(page) && page > 0 ? page : 1;
    limit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20;
    const cacheKey = await productsCacheKey(
      this.cacheManager,
      `all:${categoryId ?? 'none'}:${page}:${limit}`,
    );
    const cached = await cacheGet(this.cacheManager, cacheKey);

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
        variants: { where: { isActive: true } },
        images: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    await cacheSet(this.cacheManager, cacheKey, products);
    return products;
  }

  async findOne(id: string) {
    const cacheKey = await productsCacheKey(this.cacheManager, `one:${id}`);
    const cached = await cacheGet(this.cacheManager, cacheKey);

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

    await cacheSet(this.cacheManager, cacheKey, product);
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

  async addVariant(productId: string, dto: AddVariantDto) {
    await this.findOne(productId);

    const existingSku = await this.prisma.productVariant.findUnique({
      where: { sku: dto.sku },
    });

    if (existingSku) {
      throw new ConflictException('Ya existe una variante con ese SKU');
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        attributes: dto.attributes,
        price: dto.price,
        stock: 0,
      },
    });

    await this.invalidateProductsCache();
    return variant;
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException('Variante no encontrada');
    }

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: dto,
    });

    await this.invalidateProductsCache();
    return updated;
  }

  async addImage(productId: string, dto: AddImageDto) {
    await this.findOne(productId);

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        url: dto.url,
        order: dto.order ?? 0,
        variantId: dto.variantId,
      },
    });

    await this.invalidateProductsCache();
    return image;
  }

  async removeImage(imageId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException('Imagen no encontrada');
    }

    await this.prisma.productImage.delete({ where: { id: imageId } });
    await this.invalidateProductsCache();
    return { message: 'Imagen eliminada' };
  }

  private invalidateProductsCache() {
    return invalidateProductsCache(this.cacheManager);
  }
}
