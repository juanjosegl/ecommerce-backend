import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post('movements')
  createMovement(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.inventoryService.createMovement(dto, user.id);
  }

  @Get('movements/:variantId')
  findMovements(@Param('variantId') variantId: string) {
    return this.inventoryService.findMovementsByVariant(variantId);
  }

  @Get('low-stock')
  getLowStock(@Query('threshold') threshold?: string) {
    return this.inventoryService.getLowStockVariants(
      threshold ? parseInt(threshold, 10) : undefined,
    );
  }
}
