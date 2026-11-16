import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { invalidateProductsCache } from '../common/utils/products-cache';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async createMovement(dto: CreateMovementDto, userId?: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
    });

    if (!variant) {
      throw new NotFoundException('Variante de producto no encontrada');
    }

    if (dto.type === 'OUT' && variant.stock < dto.quantity) {
      throw new BadRequestException(
        `Stock insuficiente. Disponible: ${variant.stock}, solicitado: ${dto.quantity}`,
      );
    }

    const movement = await this.prisma.$transaction(async (tx) => {
      // Atomic update: the stock guard runs in the same statement, so two
      // concurrent OUT movements can never push stock below zero.
      const { count } = await tx.productVariant.updateMany({
        where: {
          id: dto.variantId,
          ...(dto.type === 'OUT' ? { stock: { gte: dto.quantity } } : {}),
        },
        data: {
          stock:
            dto.type === 'IN'
              ? { increment: dto.quantity }
              : { decrement: dto.quantity },
        },
      });
      if (count === 0) {
        throw new BadRequestException('Stock insuficiente');
      }

      return tx.inventoryMovement.create({
        data: {
          variantId: dto.variantId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          createdBy: userId,
        },
      });
    });

    await invalidateProductsCache(this.cacheManager);
    return movement;
  }

  async findMovementsByVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException('Variante de producto no encontrada');
    }

    return this.prisma.inventoryMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLowStockVariants(threshold: number = 5) {
    return this.prisma.productVariant.findMany({
      where: {
        stock: { lte: threshold },
        isActive: true,
      },
      include: {
        product: { select: { name: true } },
      },
      orderBy: { stock: 'asc' },
    });
  }
}
