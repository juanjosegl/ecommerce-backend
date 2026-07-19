import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkLowStock() {
    this.logger.log('Ejecutando revisión diaria de bajo stock...');

    const threshold = 5;
    const lowStockVariants = await this.prisma.productVariant.findMany({
      where: {
        stock: { lte: threshold },
        isActive: true,
      },
      include: { product: { select: { name: true } } },
    });

    if (lowStockVariants.length === 0) {
      this.logger.log('No hay variantes con bajo stock.');
      return;
    }

    this.logger.warn(
      `Se encontraron ${lowStockVariants.length} variante(s) con bajo stock:`,
    );
    lowStockVariants.forEach((v) => {
      this.logger.warn(
        `- ${v.product.name} (${v.sku}): ${v.stock} unidades`,
      );
    });

    // Cuando construyamos el módulo de Emails, aquí vamos a
    // notificar a los administradores automáticamente.
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async cancelAbandonedOrders() {
    this.logger.log('Revisando órdenes abandonadas...');

    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 24);

    const abandonedOrders = await this.prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoffTime },
      },
      include: { items: true },
    });

    if (abandonedOrders.length === 0) {
      this.logger.log('No hay órdenes abandonadas para cancelar.');
      return;
    }

    for (const order of abandonedOrders) {
      await this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });

          if (variant) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: variant.stock + item.quantity },
            });

            await tx.inventoryMovement.create({
              data: {
                variantId: item.variantId,
                type: 'IN',
                quantity: item.quantity,
                reason: `Orden ${order.id} cancelada automáticamente (abandonada)`,
              },
            });
          }
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        });
      });

      this.logger.warn(`Orden ${order.id} cancelada por abandono.`);
    }
  }
}
