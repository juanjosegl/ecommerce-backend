import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(dto: CreateOrderDto, userId: string) {
    const variantIds = dto.items.map((item) => item.variantId);

    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
    });

    if (variants.length !== variantIds.length) {
      throw new NotFoundException('Una o más variantes de producto no existen');
    }

    for (const item of dto.items) {
      const variant = variants.find((v) => v.id === item.variantId);
      if (!variant || variant.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para la variante ${variant?.sku ?? item.variantId}. Disponible: ${variant?.stock ?? 0}, solicitado: ${item.quantity}`,
        );
      }
    }

    let totalAmount = 0;
    for (const item of dto.items) {
      const variant = variants.find((v) => v.id === item.variantId)!;
      totalAmount += Number(variant.price) * item.quantity;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: 'PENDING',
          totalAmount,
        },
      });

      for (const item of dto.items) {
        const variant = variants.find((v) => v.id === item.variantId)!;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: item.variantId,
            quantity: item.quantity,
            priceAtSale: variant.price,
          },
        });

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: variant.stock - item.quantity },
        });

        await tx.inventoryMovement.create({
          data: {
            variantId: item.variantId,
            type: 'OUT',
            quantity: item.quantity,
            reason: `Venta - Orden ${order.id}`,
            createdBy: userId,
          },
        });
      }

      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              variant: { include: { product: true } },
            },
          },
        },
      });
    });

    if (user && result) {
      this.emailService.sendOrderConfirmationEmail(
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
        items: {
          include: { variant: { include: { product: true } } },
        },
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

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    return this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
