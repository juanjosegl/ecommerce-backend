import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          variantId: dto.variantId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          createdBy: userId,
        },
      });

      const newStock =
        dto.type === 'IN'
          ? variant.stock + dto.quantity
          : variant.stock - dto.quantity;

      await tx.productVariant.update({
        where: { id: dto.variantId },
        data: { stock: newStock },
      });

      return movement;
    });
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
