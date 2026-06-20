import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProcurementStrategy, ProcurementType } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'FG-TBL-002' })
  @IsString()
  @MaxLength(40)
  sku: string;

  @ApiProperty({ example: 'Wooden Coffee Table' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Finished Good' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'UNIT' })
  @IsOptional()
  @IsString()
  uom?: string;

  @ApiPropertyOptional({ example: 8500 })
  @IsOptional()
  @IsNumber()
  salesPrice?: number;

  @ApiPropertyOptional({ example: 4200 })
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiPropertyOptional({ enum: ProcurementStrategy })
  @IsOptional()
  @IsEnum(ProcurementStrategy)
  procurementStrategy?: ProcurementStrategy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  procureOnDemand?: boolean;

  @ApiPropertyOptional({ enum: ProcurementType })
  @IsOptional()
  @IsEnum(ProcurementType)
  procurementType?: ProcurementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultVendorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultBomId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  reorderPoint?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  salesPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiPropertyOptional({ enum: ProcurementStrategy })
  @IsOptional()
  @IsEnum(ProcurementStrategy)
  procurementStrategy?: ProcurementStrategy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  procureOnDemand?: boolean;

  @ApiPropertyOptional({ enum: ProcurementType })
  @IsOptional()
  @IsEnum(ProcurementType)
  procurementType?: ProcurementType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultVendorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  defaultBomId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  reorderPoint?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
