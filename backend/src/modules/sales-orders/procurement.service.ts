import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../common/services/sequence.service';

interface ExplodedComponent {
  productId: number;
  productName: string;
  totalQty: number;
  procurementType: string | null;
  defaultVendorId: number | null;
  defaultBomId: number | null;
}

interface ProcurementResult {
  manufacturingOrderId?: number;
  purchaseOrderIds: number[];
  childMoIds: number[];
}

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private prisma: PrismaService,
    private sequenceService: SequenceService,
  ) {}

  /**
   * Recursively explode a BoM for a given quantity.
   * Returns a flat list of { productId, totalQty, procurementType, ... }
   * Depth-limited to 5 levels to prevent circular BoM loops.
   */
  async explodeBom(
    bomId: number,
    quantity: number,
    depth = 0,
  ): Promise<ExplodedComponent[]> {
    if (depth > 5) {
      throw new BadRequestException('BoM explosion exceeded maximum depth of 5 levels. Check for circular BoMs.');
    }

    const bom = await this.prisma.bom.findUnique({
      where: { id: bomId },
      include: {
        components: {
          include: {
            componentProduct: {
              select: {
                id: true,
                name: true,
                procurementType: true,
                defaultVendorId: true,
                defaultBomId: true,
              },
            },
          },
        },
      },
    });

    if (!bom) throw new BadRequestException(`BoM #${bomId} not found`);

    const result: ExplodedComponent[] = [];

    for (const comp of bom.components) {
      const totalQty = Number(comp.quantityPerUnit) * quantity;
      const product  = comp.componentProduct;

      result.push({
        productId:       product.id,
        productName:     product.name,
        totalQty,
        procurementType: product.procurementType,
        defaultVendorId: product.defaultVendorId,
        defaultBomId:    product.defaultBomId,
      });

      // If this component itself is manufactured and has a BoM, recurse
      if (product.procurementType === 'MANUFACTURING' && product.defaultBomId) {
        const childComponents = await this.explodeBom(product.defaultBomId, totalQty, depth + 1);
        result.push(...childComponents);
      }
    }

    return result;
  }

  /**
   * Trigger full procurement automation for a manufactured product shortage.
   * Called from SalesOrdersService.confirm() inside a transaction.
   *
   * @param productId       The finished-good product
   * @param shortageQty     Quantity that needs to be manufactured
   * @param salesOrderId    Source SO id
   * @param userId          Acting user
   * @param tx              Prisma transaction client (optional — pass null to use prisma directly)
   * @param depth           Recursion depth guard
   */
  async triggerManufacturingProcurement(
    productId: number,
    shortageQty: number,
    salesOrderId: number,
    userId: number,
    tx?: any,
    depth = 0,
  ): Promise<ProcurementResult> {
    if (depth > 5) throw new BadRequestException('Procurement recursion depth exceeded 5 levels.');
    if (shortageQty <= 0) return { purchaseOrderIds: [], childMoIds: [] };

    const db = tx || this.prisma;

    const product = await db.product.findUnique({
      where: { id: productId },
      include: {
        defaultBom: {
          include: {
            components: {
              include: {
                componentProduct: {
                  select: {
                    id: true, name: true,
                    procurementType: true,
                    defaultVendorId: true,
                    defaultBomId: true,
                    onHandQty: true,
                    reservedQty: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) throw new BadRequestException(`Product #${productId} not found`);
    if (!product.defaultBomId || !product.defaultBom) {
      throw new BadRequestException(
        `Product "${product.name}" has procurementType=MANUFACTURING but no active BoM is linked. ` +
        `Please create a BoM and activate it before confirming this order.`
      );
    }

    const bom = product.defaultBom;

    // Create the Manufacturing Order (DRAFT)
    const moNo = await this.sequenceService.getNext('MO');
    const mo = await db.manufacturingOrder.create({
      data: {
        orderNo:          moNo,
        productId,
        bomId:            bom.id,
        quantity:         shortageQty,
        status:           'DRAFT',
        source:           'AUTO_PROCUREMENT',
        sourceReferenceId: salesOrderId,
        createdBy:        userId,
        components: {
          create: bom.components.map((c: any) => ({
            productId:   c.componentProductId,
            requiredQty: Number(c.quantityPerUnit) * shortageQty,
          })),
        },
      },
    });

    this.logger.log(`Auto-created MO ${moNo} for ${shortageQty} × ${product.name} (SO #${salesOrderId})`);

    const purchaseOrderIds: number[] = [];
    const childMoIds: number[]       = [];

    // For each component, check stock and auto-create PO or child MO if needed
    for (const comp of bom.components) {
      const compProduct = comp.componentProduct as any;
      const requiredQty = Number(comp.quantityPerUnit) * shortageQty;

      // Read fresh stock (in case tx modified it already)
      const freshProduct = await db.product.findUnique({ where: { id: compProduct.id } });
      const freeQty = Number(freshProduct!.onHandQty) - Number(freshProduct!.reservedQty);
      const compShortage = requiredQty - Math.max(freeQty, 0);

      if (compShortage <= 0) {
        this.logger.debug(`  Component ${compProduct.name}: sufficient stock (${freeQty} free, need ${requiredQty})`);
        continue;
      }

      this.logger.log(`  Component ${compProduct.name}: shortage ${compShortage} — type=${compProduct.procurementType}`);

      if (compProduct.procurementType === 'PURCHASE') {
        // Create Purchase Order for the component shortage
        if (!compProduct.defaultVendorId) {
          this.logger.warn(`  Skipping PO for ${compProduct.name} — no default vendor set`);
          continue;
        }

        const poNo = await this.sequenceService.getNext('PO');
        const po = await db.purchaseOrder.create({
          data: {
            orderNo:           poNo,
            vendorId:          compProduct.defaultVendorId,
            status:            'DRAFT',
            source:            'AUTO_PROCUREMENT',
            sourceReferenceId: salesOrderId,
            createdBy:         userId,
            lines: {
              create: [{
                productId: compProduct.id,
                quantity:  compShortage,
                unitCost:  0, // Cost will be filled in by purchase user
              }],
            },
          },
        });
        purchaseOrderIds.push(po.id);
        this.logger.log(`  Auto-created PO ${poNo} for ${compShortage} × ${compProduct.name}`);

      } else if (compProduct.procurementType === 'MANUFACTURING') {
        // Recursively create a child MO for this component
        const childResult = await this.triggerManufacturingProcurement(
          compProduct.id,
          compShortage,
          salesOrderId,
          userId,
          db,
          depth + 1,
        );
        childMoIds.push(...(childResult.childMoIds || []), childResult.manufacturingOrderId!);
        purchaseOrderIds.push(...childResult.purchaseOrderIds);
      }
    }

    return {
      manufacturingOrderId: mo.id,
      purchaseOrderIds,
      childMoIds,
    };
  }
}
