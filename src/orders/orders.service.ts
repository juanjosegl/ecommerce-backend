import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { EmailService } from '../email/email.service';
import { invalidateProductsCache } from '../common/utils/products-cache';
import { assertTransition, cancelOrderTx } from './order-status';

const orderInclude = {
  items: { include: { variant: { include: { product: true } } } },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(dto: CreateOrderDto, userId: string) {
    // Same variant twice in one payload is merged instead of rejected.
    const quantities = new Map<string, number>();
    for (const item of dto.items) {
      quantities.set(
        item.variantId,
        (quantities.get(item.variantId) ?? 0) + item.quantity,
      );
    }
    const variantIds = [...quantities.keys()];

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: { select: { isActive: true, name: true } } },
    });

    if (variants.length !== variantIds.length) {
      throw new NotFoundException('Una o más variantes de producto no existen');
    }

    for (const variant of variants) {
      if (!variant.isActive || !variant.product.isActive) {
        throw new BadRequestException(
          `${variant.product.name} (${variant.sku}) ya no está disponible`,
        );
      }
    }

    // Prices always come from the database, never from the client.
    const totalAmount = variants.reduce(
      (sum, v) => sum + Number(v.price) * quantities.get(v.id)!,
      0,
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: 'PENDING',
          totalAmount,
          shippingAddress: dto.shippingAddress
            ? { ...dto.shippingAddress }
            : undefined,
        },
      });

      for (const variant of variants) {
        const quantity = quantities.get(variant.id)!;

        // Check and decrement in one statement: concurrent checkouts can't oversell.
        const { count } = await tx.productVariant.updateMany({
          where: { id: variant.id, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (count === 0) {
          throw new BadRequestException(
            `Stock insuficiente para ${variant.product.name} (${variant.sku})`,
          );
        }

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: variant.id,
            quantity,
            priceAtSale: variant.price,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: variant.id,
            type: 'OUT',
            quantity,
            reason: `Venta - Orden ${order.id}`,
            createdBy: userId,
          },
        });
      }

      return tx.order.findUnique({
        where: { id: order.id },
        include: orderInclude,
      });
    });

    await invalidateProductsCache(this.cacheManager);

    if (user && result) {
      void this.emailService.sendOrderConfirmationEmail(
        user.email,
        user.firstName,
        result.id,
        Number(result.totalAmount),
        result.items.map((item) => ({
          productName: item.variant.product.name,
          quantity: item.quantity,
          price: Number(item.priceAtSale),
        })),
      );
    }

    return result;
  }

  async findMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        ...orderInclude,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { variant: { include: { product: true } } },
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    if (order.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('No tienes acceso a esta orden');
    }

    return order;
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        items: { include: { variant: { include: { product: true } } } },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, adminId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    assertTransition(order.status, dto.status);

    if (dto.status === 'CANCELLED') {
      await this.prisma.$transaction((tx) =>
        cancelOrderTx(
          tx,
          id,
          order.status,
          `Orden ${id} cancelada por administrador`,
          adminId,
        ),
      );
      await invalidateProductsCache(this.cacheManager);
      return this.prisma.order.findUnique({ where: { id } });
    }

    const { count } = await this.prisma.order.updateMany({
      where: { id, status: order.status },
      data: { status: dto.status },
    });
    if (count === 0) {
      throw new BadRequestException(
        'La orden cambió de estado, recarga e intenta de nuevo',
      );
    }
    return this.prisma.order.findUnique({ where: { id } });
  }
}
