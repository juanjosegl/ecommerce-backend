import { BadRequestException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

/** Allowed forward moves of an order. DELIVERED and CANCELLED are final. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(
      `No se puede cambiar una orden de ${from} a ${to}`,
    );
  }
}

/**
 * Cancels an order inside a transaction and returns every unit to stock,
 * leaving an IN movement per line so inventory stays auditable.
 * The status guard makes it safe against a concurrent cancel (no double restock).
 */
export async function cancelOrderTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  fromStatus: OrderStatus,
  reason: string,
  createdBy?: string,
) {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: fromStatus },
    data: { status: 'CANCELLED' },
  });
  if (count === 0) {
    throw new BadRequestException(
      'La orden cambió de estado, recarga e intenta de nuevo',
    );
  }

  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    await tx.productVariant.update({
      where: { id: item.variantId },
      data: { stock: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        variantId: item.variantId,
        type: 'IN',
        quantity: item.quantity,
        reason,
        createdBy,
      },
    });
  }
}
