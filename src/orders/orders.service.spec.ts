import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrdersService } from './orders.service';
import { ShippingAddressDto } from './dto/shipping-address.dto';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

function variant(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sku: `SKU-${id.slice(0, 4)}`,
    price: '50000',
    stock: 10,
    isActive: true,
    product: { isActive: true, name: 'Camisa' },
    ...overrides,
  };
}

function setup() {
  const tx = {
    order: {
      create: jest.fn().mockResolvedValue({ id: 'order-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'order-1', items: [] }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderItem: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    productVariant: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    inventoryMovement: { create: jest.fn() },
  };
  const prisma = {
    productVariant: { findMany: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    order: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const cache = { get: jest.fn(), set: jest.fn() };
  const email = { sendOrderConfirmationEmail: jest.fn() };
  const service = new OrdersService(
    prisma as never,
    email as never,
    cache as never,
  );
  return { service, prisma, tx, cache };
}

describe('OrdersService.create', () => {
  it('merges repeated variants and prices from the database', async () => {
    const { service, prisma, tx, cache } = setup();
    prisma.productVariant.findMany.mockResolvedValue([
      variant(V1),
      variant(V2, { price: '20000' }),
    ]);

    await service.create(
      {
        items: [
          { variantId: V1, quantity: 1 },
          { variantId: V2, quantity: 2 },
          { variantId: V1, quantity: 2 },
        ],
      },
      'user-1',
    );

    const [[createArgs]] = tx.order.create.mock.calls as [
      [{ data: { totalAmount: number } }],
    ];
    expect(createArgs.data.totalAmount).toBe(3 * 50000 + 2 * 20000);
    expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: V1, stock: { gte: 3 } },
      data: { stock: { decrement: 3 } },
    });
    expect(tx.orderItem.create).toHaveBeenCalledTimes(2);
    expect(cache.set).toHaveBeenCalled(); // product cache invalidated
  });

  it('rejects inactive variants or products', async () => {
    const { service, prisma } = setup();
    prisma.productVariant.findMany.mockResolvedValue([
      variant(V1, { product: { isActive: false, name: 'Camisa' } }),
    ]);
    await expect(
      service.create({ items: [{ variantId: V1, quantity: 1 }] }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails the whole transaction when stock ran out concurrently', async () => {
    const { service, prisma, tx } = setup();
    prisma.productVariant.findMany.mockResolvedValue([variant(V1)]);
    tx.productVariant.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.create({ items: [{ variantId: V1, quantity: 1 }] }, 'u'),
    ).rejects.toThrow('Stock insuficiente');
    expect(tx.orderItem.create).not.toHaveBeenCalled();
  });
});

describe('OrdersService.updateStatus', () => {
  it('rejects moves out of a final state', async () => {
    const { service, prisma } = setup();
    prisma.order.findUnique.mockResolvedValue({ id: 'o', status: 'DELIVERED' });
    await expect(
      service.updateStatus('o', { status: 'PENDING' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns stock when an order is cancelled', async () => {
    const { service, prisma, tx } = setup();
    prisma.order.findUnique.mockResolvedValue({ id: 'o', status: 'CONFIRMED' });
    tx.orderItem.findMany.mockResolvedValue([
      { variantId: V1, quantity: 2 },
      { variantId: V2, quantity: 1 },
    ]);

    await service.updateStatus('o', { status: 'CANCELLED' }, 'admin');

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o', status: 'CONFIRMED' },
      data: { status: 'CANCELLED' },
    });
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: V1 },
      data: { stock: { increment: 2 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(2);
  });
});

describe('ShippingAddressDto', () => {
  const valid = {
    fullName: 'María José Pérez',
    phone: '310 555 1234',
    address: 'Calle 5 # 10-20',
    city: 'Popayán',
    department: 'Cauca',
  };

  it('accepts a Colombian mobile with spaces', async () => {
    expect(
      await validate(plainToInstance(ShippingAddressDto, valid)),
    ).toHaveLength(0);
  });

  it.each([
    ['phone', '6025551234'],
    ['fullName', '1234'],
    ['address', 'abc'],
  ])('rejects an invalid %s', async (field, value) => {
    const errors = await validate(
      plainToInstance(ShippingAddressDto, { ...valid, [field]: value }),
    );
    expect(errors.map((e) => e.property)).toContain(field);
  });
});
