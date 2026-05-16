-- CreateEnum
CREATE TYPE "TenantType" AS ENUM ('MASTER_ADMIN', 'CUSTOMER', 'TRIAL');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'PRODUCTION', 'ACCOUNTING', 'SALES', 'DESIGNER', 'STAFF', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('JA', 'EN', 'ZH', 'VI');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('JPY', 'USD', 'CNY', 'VND', 'EUR');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'READ', 'EXPORT', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'STATUS_CHANGE', 'PRIVILEGED_ACCESS');

-- CreateEnum
CREATE TYPE "ClientBusinessType" AS ENUM ('APPAREL_BRAND', 'SELECT_SHOP', 'TRADING_COMPANY', 'INDIVIDUAL', 'WHOLESALE', 'ONLINE_RETAILER', 'PRIVATE_BRAND', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientSize" AS ENUM ('INDIVIDUAL', 'SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "ClientDisplayPattern" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('REFERRAL', 'WEB_SEARCH', 'EXHIBITION', 'SOCIAL_MEDIA', 'EMAIL', 'PHONE', 'EXISTING_CLIENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentTermType" AS ENUM ('MONTHLY_CLOSING', 'DEPOSIT_COD', 'ADVANCE_PAYMENT', 'CASH_ON_DELIVERY', 'LETTER_OF_CREDIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('SHUNYA', 'CLIENT', 'SHARED', 'CONTRACT_BASED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PROSPECT', 'PAUSED', 'ARCHIVED', 'BLACKLIST');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('FABRIC', 'LINING', 'INTERLINING', 'TRIM', 'ZIPPER', 'BUTTON', 'THREAD', 'LABEL', 'HANG_TAG', 'PACKAGING', 'ORIGINAL_FABRIC', 'USED_CLOTHING', 'PRE_MADE', 'OTHER');

-- CreateEnum
CREATE TYPE "FactoryType" AS ENUM ('SEWING', 'KNITTING', 'CUTTING', 'PRINTING', 'EMBROIDERY', 'WASHING', 'DYEING', 'FINISHING', 'PATTERN_MAKING', 'SAMPLE_MAKING', 'ASSEMBLY', 'OTHER');

-- CreateEnum
CREATE TYPE "FactoryContractType" AS ENUM ('CMT', 'FULL_PACKAGE', 'CUT_ONLY', 'ASSEMBLY_ONLY', 'PROCESSING_ONLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ContractorSpecialty" AS ENUM ('PATTERN_MAKING', 'GRADING', 'CAD', 'DESIGN', 'SAMPLE_MAKING', 'TECHNICAL_DRAWING', 'CLO3D', 'ILLUSTRATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractorContractType" AS ENUM ('PACKAGE', 'HOURLY', 'PER_TASK', 'MONTHLY', 'HYBRID');

-- CreateEnum
CREATE TYPE "RoyaltyType" AS ENUM ('NONE', 'PERCENTAGE', 'PER_UNIT', 'HYBRID');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('FABRIC', 'LINING', 'INTERLINING', 'ZIPPER', 'BUTTON', 'THREAD', 'ELASTIC', 'TAPE', 'LABEL', 'HANG_TAG', 'CARE_LABEL', 'PACKAGING_BAG', 'POLYBAG', 'BOX', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('PATTERN_FEE', 'GRADING_FEE', 'SAMPLE_FEE', 'INSPECTION_FEE', 'TRANSPORT_FEE', 'CUSTOMS_FEE', 'TARIFF', 'IMPORT_TAX', 'STORAGE_FEE', 'PROCESSING_FEE', 'PRINTING_FEE', 'EMBROIDERY_FEE', 'WASHING_FEE', 'PHOTOGRAPHY_FEE', 'RENTAL_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('FIXED', 'PER_UNIT', 'PERCENTAGE', 'WEIGHT_BASED', 'VOLUME_BASED', 'DISTANCE_BASED');

-- CreateEnum
CREATE TYPE "InquiryType" AS ENUM ('DIRECT_SAMPLE', 'PLANNING', 'QUOTATION', 'GENERAL', 'RECURRING');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('INITIAL_CONTACT', 'IN_DISCUSSION', 'QUOTATION_SENT', 'CONVERTED', 'LOST', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LossReason" AS ENUM ('PRICE_TOO_HIGH', 'DELIVERY_MISMATCH', 'SPEC_CHANGE', 'CANCELLED', 'COMPETITOR', 'NO_RESPONSE', 'NOT_FIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ModelCodeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('PLANNING', 'SAMPLE_REQUESTED', 'SAMPLE_IN_PROGRESS', 'SAMPLE_APPROVED', 'ORDERING_PERIOD', 'ORDER_CONFIRMED', 'MASS_PRODUCTION', 'INSPECTION', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SkuMoqStatus" AS ENUM ('NOT_DETERMINED', 'MEETS_MOQ', 'BELOW_MOQ_PRODUCE', 'BELOW_MOQ_PRICE_UP', 'EXCLUDED', 'NO_ORDERS', 'PENDING_DECISION');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RepetitionType" AS ENUM ('EXACT_REPEAT', 'MINOR_CHANGE', 'MAJOR_CHANGE', 'SEASONAL_VARIATION', 'COLLABORATION');

-- CreateEnum
CREATE TYPE "SpecificationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED_INTERNAL', 'SUBMITTED', 'CLIENT_APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PatternWorkType" AS ENUM ('NEW', 'REVISION', 'GRADING', 'RE_GRADING', 'COPY');

-- CreateEnum
CREATE TYPE "PatternVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "DesignType" AS ENUM ('INITIAL', 'REVISION', 'COLOR_ADDITION', 'SIZE_ADDITION', 'COLLABORATION', 'FINAL');

-- CreateEnum
CREATE TYPE "DesignVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'CLIENT_APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BomItemCategory" AS ENUM ('MAIN_FABRIC', 'LINING_FABRIC', 'INTERLINING', 'ZIPPER', 'BUTTON', 'THREAD', 'ELASTIC', 'TAPE', 'RIVET', 'BRAND_LABEL', 'SIZE_LABEL', 'CARE_LABEL', 'HANG_TAG', 'POLYBAG', 'OPP_BAG', 'BOX', 'TISSUE', 'ACCESSORY', 'OTHER');

-- CreateEnum
CREATE TYPE "MoodboardItemType" AS ENUM ('IMAGE', 'TEXT', 'COLOR_CHIP', 'FABRIC_SWATCH', 'REFERENCE_LINK', 'FILE');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('LOGO', 'GRAPHIC', 'COLOR_PALETTE', 'FONT', 'ITEM_DESIGN', 'PATTERN_GRAPHIC', 'ICON', 'ILLUSTRATION', 'PHOTO_REFERENCE', 'TEMPLATE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStorageLocation" AS ENUM ('SYSTEM_R2', 'GOOGLE_DRIVE', 'EXTERNAL_URL');

-- CreateEnum
CREATE TYPE "ShootType" AS ENUM ('LOOKBOOK', 'EC', 'SNS', 'PR', 'CATALOG', 'EDITORIAL', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "PhotographyStatus" AS ENUM ('PLANNING', 'SCHEDULED', 'IN_PROGRESS', 'SHOOT_COMPLETED', 'RETOUCHING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationType" AS ENUM ('SAMPLE', 'MASS', 'FINAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED_INTERNAL', 'SUBMITTED', 'CLIENT_APPROVED', 'CLIENT_REJECTED', 'EXPIRED', 'CONVERTED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExternalCostCategory" AS ENUM ('MATERIAL', 'SEWING', 'PROCESSING', 'OVERHEAD');

-- CreateEnum
CREATE TYPE "InternalCostCategory" AS ENUM ('MAIN_FABRIC', 'LINING', 'INTERLINING', 'ZIPPER', 'BUTTON', 'THREAD', 'ACCESSORY', 'LABEL', 'PACKAGING', 'REGULAR_SEWING', 'SPECIAL_SEWING', 'FINISHING', 'PRINTING', 'EMBROIDERY', 'WASHING', 'DYEING', 'SPECIAL_PROCESSING', 'PATTERN_FEE', 'GRADING_FEE', 'SAMPLE_FEE', 'INSPECTION_FEE', 'DOMESTIC_TRANSPORT', 'INTERNATIONAL_TRANSPORT', 'CUSTOMS_FEE', 'TARIFF', 'IMPORT_TAX', 'STORAGE_FEE', 'INSURANCE', 'REMITTANCE_FEE', 'FX_LOSS', 'ROYALTY', 'PHOTOGRAPHY_FEE', 'DESIGN_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "MarginSource" AS ENUM ('COMPANY_DEFAULT', 'BRAND_LEVEL', 'PRODUCT_LEVEL', 'ITEM_LEVEL', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "MarginLevel" AS ENUM ('COMPANY_DEFAULT', 'BRAND_LEVEL', 'PRODUCT_LEVEL', 'ITEM_LEVEL');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'COMMENT', 'ESCALATED', 'RE_SUBMITTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalActorType" AS ENUM ('INTERNAL', 'CLIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "QuotationPdfType" AS ENUM ('CLIENT_FACING', 'INTERNAL_DETAILED', 'COST_ANALYSIS', 'COMPARISON');

-- CreateEnum
CREATE TYPE "ConversionType" AS ENUM ('DIRECT', 'WITH_PRICE_CHANGE', 'WITH_QUANTITY_CHANGE', 'PARTIAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "PurchaseOrderType" AS ENUM ('SPEC_BASED', 'ONLINE', 'STANDARD');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('DIRECT', 'SHARED', 'STOCK');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'IN_PRODUCTION', 'SHIPPED', 'RECEIVED', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('SEWING', 'CUTTING', 'PRINTING', 'EMBROIDERY', 'WASHING', 'DYEING', 'FINISHING', 'PATTERN_MAKING', 'PATTERN_REVISION', 'GRADING', 'SAMPLE_MAKING', 'ASSEMBLY', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkOrderCategory" AS ENUM ('PRODUCTION', 'SAMPLE', 'PATTERN', 'GRADING', 'REWORK', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'IN_PRODUCTION', 'QUALITY_CHECK', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "OrderSourceType" AS ENUM ('ORDER_PAGE', 'SAAGARA_V2', 'EMAIL', 'PDF_DOCUMENT', 'EXCEL_FILE', 'PAPER_DOCUMENT', 'PHONE', 'CHAT', 'EXHIBITION', 'DIRECT_VISIT', 'OTHER');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('TENTATIVE', 'CONFIRMED', 'IN_PRODUCTION', 'PARTIAL_DELIVERED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "OrderChangeType" AS ENUM ('QUANTITY_CHANGE', 'PRICE_CHANGE', 'SKU_ADDITION', 'SKU_REMOVAL', 'DELIVERY_DATE_CHANGE', 'DESTINATION_CHANGE', 'STATUS_CHANGE', 'CANCELLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderPageAccessType" AS ENUM ('PUBLIC', 'LINK_ONLY', 'PASSWORD_PROTECTED', 'AUTHENTICATED', 'INVITATION_ONLY');

-- CreateEnum
CREATE TYPE "SampleRound" AS ENUM ('FIRST', 'SECOND', 'THIRD', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "SampleProductionStatus" AS ENUM ('PLANNING', 'PATTERN_IN_PROGRESS', 'MATERIAL_ORDERING', 'SEWING_IN_PROGRESS', 'COMPLETED', 'IN_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SampleRevisionType" AS ENUM ('DESIGN', 'PATTERN', 'MATERIAL', 'COLOR', 'SIZE', 'STITCHING', 'FIT', 'DETAILS', 'OTHER');

-- CreateEnum
CREATE TYPE "RevisionRequestor" AS ENUM ('CLIENT', 'INTERNAL', 'FACTORY', 'DESIGNER', 'PATTERN_MAKER');

-- CreateEnum
CREATE TYPE "StatusCheckTargetType" AS ENUM ('PURCHASE_ORDER', 'WORK_ORDER', 'SALES_ORDER', 'MIXED');

-- CreateEnum
CREATE TYPE "StorageLocationType" AS ENUM ('OWN_WAREHOUSE_A', 'OWN_WAREHOUSE_B', 'EXTERNAL_WAREHOUSE', 'OFFICE_STORAGE', 'OVERSEAS_SUPPLIER', 'OVERSEAS_FACTORY', 'IN_TRANSIT_SEA', 'IN_TRANSIT_AIR', 'IN_TRANSIT_LAND', 'CUSTOMS_CLEARANCE', 'CLIENT_LOCATION', 'TEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryLotStatus" AS ENUM ('PENDING_RECEIPT', 'IN_STOCK', 'PARTIALLY_USED', 'DEPLETED', 'EXPIRED', 'DAMAGED', 'LOST', 'RETURNED', 'WRITTEN_OFF', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "InventoryType" AS ENUM ('STANDARD', 'ORIGINAL_FABRIC', 'CLIENT_CONSIGNED', 'FACTORY_CONSIGNED', 'SAMPLE', 'RETURNED');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT_FROM_PO', 'RECEIPT_FROM_FACTORY', 'RECEIPT_FROM_RETURN', 'RECEIPT_FROM_OTHER', 'ISSUE_FOR_PRODUCTION', 'ISSUE_FOR_SAMPLE', 'ISSUE_FOR_FACTORY', 'ISSUE_FOR_CONTRACTOR', 'ISSUE_FOR_CLIENT', 'TRANSFER_BETWEEN_LOCATIONS', 'TRANSFER_TO_FACTORY_STOCK', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'WRITE_OFF', 'DAMAGE', 'LOSS', 'EXPIRY', 'SURPLUS_RETURN', 'SURPLUS_CLIENT_BUYBACK');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ValuationPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'AD_HOC');

-- CreateEnum
CREATE TYPE "ValuationMethod" AS ENUM ('MOVING_AVERAGE', 'FIFO', 'LIFO', 'SPECIFIC_IDENTIFICATION');

-- CreateEnum
CREATE TYPE "InventoryAlertType" AS ENUM ('LOW_STOCK', 'EXCESS_STOCK', 'EXPIRY_WARNING', 'QUALITY_ISSUE', 'LOST_OR_DAMAGED', 'DELIVERY_DELAY', 'ALLOCATION_CONFLICT', 'COST_DEVIATION');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FinishedGoodsMovementType" AS ENUM ('PRODUCTION_RECEIPT', 'RETURN_RECEIPT', 'ADJUSTMENT_IN', 'SALES_DELIVERY', 'SAMPLE_USE', 'INTERNAL_USE', 'GIFT', 'DEFECT_REGISTRATION', 'REWORK', 'WRITE_OFF', 'DISPOSAL', 'CLIENT_BUYBACK', 'TRANSFER');

-- CreateEnum
CREATE TYPE "FactoryConsignedStatus" AS ENUM ('ACTIVE', 'FULLY_CONSUMED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "StocktakingScope" AS ENUM ('FULL', 'BY_LOCATION', 'BY_CATEGORY', 'BY_SUPPLIER', 'SPOT_CHECK');

-- CreateEnum
CREATE TYPE "StocktakingStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COUNTING_COMPLETED', 'RECONCILING', 'PENDING_APPROVAL', 'APPROVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscrepancyReason" AS ENUM ('COUNTING_ERROR', 'SYSTEM_ERROR', 'THEFT', 'DAMAGE', 'EXPIRY', 'UNRECORDED_USAGE', 'UNRECORDED_RETURN', 'MISPLACED', 'EVAPORATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('STOCK_ADJUSTMENT', 'LOSS_ENTRY', 'GAIN_ENTRY', 'WRITE_OFF', 'RECOUNT_NEEDED', 'NO_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SurplusDispositionStatus" AS ENUM ('PENDING', 'DECIDED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RECEIVED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PREPARING', 'PICKED_UP', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('STANDARD', 'DEPOSIT', 'PROFORMA', 'PROGRESS', 'FINAL', 'CREDIT_NOTE', 'DEBIT_NOTE', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "InvoiceTransactionType" AS ENUM ('DOMESTIC_TAXABLE_10', 'DOMESTIC_REDUCED_8', 'EXPORT', 'IMPORT', 'INTERNATIONAL', 'MIXED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'WIRE_TRANSFER_TT', 'LETTER_OF_CREDIT', 'CASH', 'CREDIT_CARD', 'CHECK', 'PAYPAL', 'WISE', 'OTHER');

-- CreateEnum
CREATE TYPE "BankFeeBurden" AS ENUM ('SENDER', 'RECEIVER', 'SHARED');

-- CreateEnum
CREATE TYPE "TaxClassification" AS ENUM ('STANDARD_10', 'REDUCED_8', 'EXEMPT', 'NON_TAXABLE', 'OUT_OF_SCOPE', 'ZERO_RATED');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "CounterpartType" AS ENUM ('CLIENT', 'SUPPLIER', 'FACTORY', 'CONTRACTOR', 'BUYER', 'CARRIER', 'CUSTOMS_BROKER', 'PHOTOGRAPHER', 'RENTAL_COMPANY', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SCHEDULED', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'CONFIRMED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_COMPLETED');

-- CreateEnum
CREATE TYPE "RemittanceStatus" AS ENUM ('INITIATED', 'PROCESSING', 'IN_TRANSIT', 'ARRIVED', 'CONFIRMED', 'FAILED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FxRecordType" AS ENUM ('AT_TRANSACTION', 'AT_SETTLEMENT', 'PERIOD_END', 'REALIZATION', 'UNREALIZED');

-- CreateEnum
CREATE TYPE "TaxCalculationType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'INTERIM');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('EXPORT', 'IMPORT', 'TRILATERAL', 'RE_EXPORT', 'TRANSIT', 'PROCESSING');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('SUPPLIER', 'FACTORY', 'CLIENT', 'BUYER', 'OWN_COMPANY', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "IncotermType" AS ENUM ('EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('SEA', 'AIR', 'LAND', 'RAIL', 'MULTIMODAL', 'COURIER');

-- CreateEnum
CREATE TYPE "TradeTransactionStatus" AS ENUM ('PLANNING', 'DOCUMENTS_PREP', 'DOCUMENTS_READY', 'CUSTOMS_EXPORT', 'IN_TRANSIT', 'CUSTOMS_IMPORT', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'SENT', 'ACKNOWLEDGED', 'REVISED', 'CANCELLED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CertificateOfOriginType" AS ENUM ('GENERAL', 'PREFERENTIAL_EPA', 'PREFERENTIAL_RCEP', 'PREFERENTIAL_ACFTA', 'PREFERENTIAL_OTHER', 'GSP', 'CHAMBER', 'SELF_DECLARATION');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('PLANNED', 'APPLIED', 'ISSUED', 'RECEIVED', 'USED', 'EXPIRED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillOfLadingType" AS ENUM ('MASTER_BL', 'HOUSE_BL', 'SEAWAY_BILL', 'STRAIGHT_BL', 'ORDER_BL', 'BEARER_BL', 'TELEX_RELEASE');

-- CreateEnum
CREATE TYPE "AirWaybillType" AS ENUM ('MAWB', 'HAWB', 'DIRECT');

-- CreateEnum
CREATE TYPE "CustomsDeclarationType" AS ENUM ('EXPORT', 'IMPORT', 'RE_EXPORT', 'TRANSIT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "CustomsDeclarationStatus" AS ENUM ('PREPARING', 'SUBMITTED', 'UNDER_REVIEW', 'INSPECTION', 'APPROVED', 'CLEARED', 'REJECTED', 'AMENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TradeDocumentType" AS ENUM ('COMMERCIAL_INVOICE', 'PACKING_LIST', 'CERTIFICATE_OF_ORIGIN', 'BILL_OF_LADING', 'AIR_WAYBILL', 'PROFORMA_INVOICE', 'LETTER_OF_CREDIT', 'INSURANCE_CERTIFICATE', 'INSPECTION_CERTIFICATE', 'FUMIGATION_CERTIFICATE', 'CUSTOMS_DECLARATION', 'CUSTOMS_RECEIPT', 'IMPORT_LICENSE', 'EXPORT_LICENSE', 'CONTRACT', 'PURCHASE_ORDER', 'SHIPPING_INSTRUCTIONS', 'DOCK_RECEIPT', 'CARGO_RECEIPT', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceCheckType" AS ENUM ('SANCTIONS_LIST', 'EXPORT_CONTROL', 'IMPORT_RESTRICTION', 'LICENSING', 'PRODUCT_REGULATION', 'COUNTRY_RESTRICTION', 'TAX_COMPLIANCE', 'CUSTOMS_VALUATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PASSED', 'WARNING', 'FAILED', 'PENDING_REVIEW', 'REQUIRES_LICENSE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "CommentFormat" AS ENUM ('PLAIN', 'MARKDOWN', 'HTML');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('GENERAL', 'QUESTION', 'ANSWER', 'FEEDBACK', 'APPROVAL', 'REJECTION', 'REVISION_REQUEST', 'TASK', 'DECISION', 'ANNOUNCEMENT', 'INTERNAL_NOTE');

-- CreateEnum
CREATE TYPE "CommentPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PRODUCT_STATUS_CHANGE', 'PRODUCT_ASSIGNED', 'SAMPLE_COMPLETED', 'SAMPLE_REVISION_REQUESTED', 'QUOTATION_SUBMITTED', 'QUOTATION_APPROVED', 'QUOTATION_REJECTED', 'QUOTATION_EXPIRING_SOON', 'PO_RECEIVED', 'WO_PROGRESS_UPDATE', 'ORDER_DELAYED', 'ORDER_COMPLETED', 'NEW_ORDER_RECEIVED', 'ORDER_CHANGED', 'ORDER_CANCELLED', 'LOW_STOCK_ALERT', 'EXCESS_STOCK_ALERT', 'EXPIRY_WARNING', 'INVOICE_RECEIVED', 'PAYMENT_DUE_SOON', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'FX_RATE_ALERT', 'COMMENT_MENTION', 'COMMENT_REPLY', 'COMMENT_TASK_ASSIGNED', 'SYSTEM_UPDATE', 'SECURITY_ALERT', 'WELCOME', 'TRIAL_EXPIRING', 'AI_EMAIL_DRAFT_READY', 'AI_MEETING_SUMMARY_READY', 'AI_TRANSLATION_READY', 'CUSTOMS_CLEARANCE_UPDATE', 'CERTIFICATE_EXPIRING', 'REMINDER', 'ANNOUNCEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('PROJECT', 'QUOTATION', 'ORDER', 'SALES', 'INVENTORY', 'FINANCE', 'COMMUNICATION', 'SYSTEM', 'AI', 'TRADE', 'REMINDER');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SLACK', 'TEAMS', 'LINE', 'SMS');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('UNPROCESSED', 'AI_PROCESSING', 'CLASSIFIED', 'ASSIGNED', 'IN_PROGRESS', 'REPLIED', 'RESOLVED', 'ARCHIVED', 'SPAM', 'DELETED');

-- CreateEnum
CREATE TYPE "EmailClassification" AS ENUM ('BUSINESS_INQUIRY', 'CLIENT_COMMUNICATION', 'SUPPLIER_COMMUNICATION', 'FACTORY_COMMUNICATION', 'CONTRACTOR_COMMUNICATION', 'ORDER_CONFIRMATION', 'ORDER_UPDATE', 'DELIVERY_NOTICE', 'QUOTATION_REQUEST', 'QUOTATION_RESPONSE', 'INVOICE_RECEIVED', 'PAYMENT_NOTICE', 'PATTERN_DELIVERY', 'SAMPLE_FEEDBACK', 'NEWSLETTER', 'PROMOTION', 'PERSONAL', 'SPAM', 'UNCLEAR', 'REQUIRES_HUMAN');

-- CreateEnum
CREATE TYPE "ClassificationMethod" AS ENUM ('LOCAL_RULE', 'AI_HAIKU', 'AI_SONNET', 'AI_OPUS', 'MANUAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "AiProcessingType" AS ENUM ('EMAIL_CLASSIFICATION', 'EMAIL_DRAFT_GENERATION', 'MEETING_TRANSCRIPTION', 'MEETING_SUMMARIZATION', 'TRANSLATION', 'CHAT_ASSISTANT', 'SPEC_SHEET_DRAFT', 'COST_ANOMALY_DETECTION', 'DELIVERY_DELAY_PREDICTION', 'IMAGE_RECOGNITION', 'DOCUMENT_OCR', 'DATA_EXTRACTION', 'CONTENT_MODERATION', 'OTHER');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('INTERNAL', 'CLIENT_MEETING', 'SUPPLIER_MEETING', 'FACTORY_MEETING', 'WEEKLY_TEAM', 'PROJECT_KICKOFF', 'PROJECT_REVIEW', 'DESIGN_REVIEW', 'TECHNICAL_REVIEW', 'TRADE_DISCUSSION', 'OTHER');

-- CreateEnum
CREATE TYPE "MeetingTranscriptStatus" AS ENUM ('DRAFT', 'PROCESSING', 'REVIEW', 'FINALIZED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('QUOTATION', 'PURCHASE_ORDER', 'WORK_ORDER', 'INVOICE', 'DELIVERY_NOTE', 'SPECIFICATION', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'EMAIL_TEMPLATE', 'REPORT', 'LABEL', 'OTHER');

-- CreateEnum
CREATE TYPE "TemplateLevel" AS ENUM ('COMPANY_DEFAULT', 'USE_CASE', 'CLIENT_LEVEL', 'SUPPLIER_LEVEL', 'BRAND_LEVEL');

-- CreateEnum
CREATE TYPE "ImportTargetEntity" AS ENUM ('CLIENTS', 'BRANDS', 'SUPPLIERS', 'FACTORIES', 'CONTRACTORS', 'BUYERS', 'DELIVERY_DESTINATIONS', 'MATERIALS', 'PRODUCT_CATEGORIES', 'EXPENSE_CATEGORIES', 'PRODUCTS', 'MODEL_CODES', 'USERS', 'EXCHANGE_RATES', 'OTHER');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'EXCEL', 'JSON', 'PDF', 'XML');

-- CreateEnum
CREATE TYPE "IntegrationServiceType" AS ENUM ('GOOGLE_WORKSPACE', 'GMAIL', 'GOOGLE_DRIVE', 'GOOGLE_CALENDAR', 'GOOGLE_MEET', 'GOOGLE_CHAT', 'RESEND', 'SENDGRID', 'CLOUDFLARE_R2', 'AWS_S3', 'ANTHROPIC_CLAUDE', 'WECHAT', 'LINE', 'ZALO', 'GIGAFILE', 'WETRANSFER', 'SAAGARA_V2', 'TRANSCRIPTION_TOOL', 'CARE_LABEL_TOOL', 'BANK_API', 'STRIPE', 'PAYPAL', 'SHIPPING_API', 'CUSTOMS_API', 'BOJ_API', 'EXCHANGE_RATE_API', 'SENTRY', 'ANALYTICS', 'CUSTOM_API', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'CONFIGURED', 'CONNECTED', 'DISCONNECTED', 'ERROR', 'SUSPENDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "legal_entity" VARCHAR(255),
    "tax_id" VARCHAR(50),
    "tenant_type" "TenantType" NOT NULL DEFAULT 'CUSTOMER',
    "subscription_plan" VARCHAR(100),
    "contract_start_date" TIMESTAMP(3),
    "contract_end_date" TIMESTAMP(3),
    "postal_code" VARCHAR(20),
    "address" TEXT,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "website" VARCHAR(255),
    "default_language" "Language" NOT NULL DEFAULT 'JA',
    "default_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Tokyo',
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200),
    "avatar_url" VARCHAR(500),
    "phone" VARCHAR(50),
    "language" "Language" NOT NULL DEFAULT 'JA',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Tokyo',
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "is_external_user" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_login_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(50),
    "user_agent" TEXT,
    "success" BOOLEAN NOT NULL,
    "fail_reason" VARCHAR(255),

    CONSTRAINT "user_login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" VARCHAR(50),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255),
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" VARCHAR(50),
    "user_agent" TEXT,
    "description" TEXT,
    "is_privileged_access" BOOLEAN NOT NULL DEFAULT false,
    "accessed_tenant_id" TEXT,
    "access_reason" TEXT,
    "customer_consent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "client_code" VARCHAR(50) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "legal_entity" VARCHAR(255),
    "business_type" "ClientBusinessType" NOT NULL,
    "client_size" "ClientSize",
    "postal_code" VARCHAR(20),
    "country" VARCHAR(2) NOT NULL DEFAULT 'JP',
    "prefecture" VARCHAR(50),
    "city" VARCHAR(100),
    "address" TEXT,
    "phone" VARCHAR(50),
    "fax" VARCHAR(50),
    "email" VARCHAR(255),
    "website" VARCHAR(500),
    "instagram" VARCHAR(255),
    "twitter" VARCHAR(255),
    "tax_id" VARCHAR(50),
    "is_qualified_invoice_issuer" BOOLEAN NOT NULL DEFAULT true,
    "payment_term_type" "PaymentTermType" NOT NULL DEFAULT 'MONTHLY_CLOSING',
    "closing_day" INTEGER,
    "payment_days" INTEGER,
    "deposit_required" BOOLEAN NOT NULL DEFAULT false,
    "deposit_percentage" DECIMAL(5,2),
    "preferred_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "preferred_language" "Language" NOT NULL DEFAULT 'JA',
    "display_pattern" "ClientDisplayPattern" NOT NULL DEFAULT 'B',
    "lead_source" "LeadSource",
    "referrer" VARCHAR(255),
    "inquiry_count" INTEGER NOT NULL DEFAULT 0,
    "successful_count" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(15,2),
    "last_inquiry_at" TIMESTAMP(3),
    "last_transaction_at" TIMESTAMP(3),
    "pattern_ownership" "OwnershipType" NOT NULL DEFAULT 'SHUNYA',
    "design_ownership" "OwnershipType" NOT NULL DEFAULT 'SHUNYA',
    "primary_contact_id" TEXT,
    "assigned_to_user_id" TEXT,
    "notes" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200),
    "job_title" VARCHAR(255),
    "department" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "brand_code" VARCHAR(20) NOT NULL,
    "brand_name" VARCHAR(255) NOT NULL,
    "brand_name_en" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "brand_colors" JSONB,
    "concept" TEXT,
    "default_margin_rate" DECIMAL(5,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "supplier_code" VARCHAR(50) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "company_name_en" VARCHAR(255),
    "supplier_type" "SupplierType"[],
    "country" VARCHAR(2) NOT NULL DEFAULT 'JP',
    "postal_code" VARCHAR(20),
    "address" TEXT,
    "address_en" TEXT,
    "phone" VARCHAR(50),
    "fax" VARCHAR(50),
    "email" VARCHAR(255),
    "website" VARCHAR(500),
    "chat_tool" VARCHAR(50),
    "chat_tool_id" VARCHAR(255),
    "preferred_language" "Language" NOT NULL DEFAULT 'JA',
    "preferred_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "timezone" VARCHAR(50),
    "tax_id" VARCHAR(50),
    "is_qualified_invoice_issuer" BOOLEAN NOT NULL DEFAULT true,
    "payment_term_type" "PaymentTermType" NOT NULL DEFAULT 'MONTHLY_CLOSING',
    "closing_day" INTEGER,
    "payment_days" INTEGER,
    "bank_name" VARCHAR(255),
    "bank_swift_code" VARCHAR(20),
    "bank_iban" VARCHAR(50),
    "bank_account_info" JSONB,
    "po_template_id" TEXT,
    "quality_rating" INTEGER,
    "delivery_rating" INTEGER,
    "price_rating" INTEGER,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200),
    "job_title" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" "Language",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "factory_code" VARCHAR(50) NOT NULL,
    "factory_name" VARCHAR(255) NOT NULL,
    "factory_name_en" VARCHAR(255),
    "factory_types" "FactoryType"[],
    "contract_types" "FactoryContractType"[],
    "country" VARCHAR(2) NOT NULL DEFAULT 'JP',
    "postal_code" VARCHAR(20),
    "address" TEXT,
    "address_en" TEXT,
    "phone" VARCHAR(50),
    "fax" VARCHAR(50),
    "email" VARCHAR(255),
    "chat_tool" VARCHAR(50),
    "chat_tool_id" VARCHAR(255),
    "preferred_language" "Language" NOT NULL DEFAULT 'JA',
    "preferred_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "timezone" VARCHAR(50),
    "tax_id" VARCHAR(50),
    "is_qualified_invoice_issuer" BOOLEAN NOT NULL DEFAULT true,
    "payment_term_type" "PaymentTermType" NOT NULL DEFAULT 'MONTHLY_CLOSING',
    "closing_day" INTEGER,
    "payment_days" INTEGER,
    "bank_name" VARCHAR(255),
    "bank_swift_code" VARCHAR(20),
    "bank_iban" VARCHAR(50),
    "bank_account_info" JSONB,
    "monthly_capacity" INTEGER,
    "minimum_order_qty" INTEGER,
    "average_lead_time_days" INTEGER,
    "standard_labor_rates" JSONB,
    "quality_rating" INTEGER,
    "delivery_rating" INTEGER,
    "price_rating" INTEGER,
    "defect_rate" DECIMAL(5,2),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "factories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory_contacts" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200),
    "job_title" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "mobile" VARCHAR(50),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" "Language",
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "factory_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "contractor_code" VARCHAR(50) NOT NULL,
    "contractor_name" VARCHAR(255) NOT NULL,
    "contractor_name_en" VARCHAR(255),
    "is_individual" BOOLEAN NOT NULL DEFAULT true,
    "specialties" "ContractorSpecialty"[],
    "country" VARCHAR(2) NOT NULL DEFAULT 'JP',
    "address" TEXT,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "chat_tool" VARCHAR(50),
    "chat_tool_id" VARCHAR(255),
    "preferred_language" "Language" NOT NULL DEFAULT 'JA',
    "preferred_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "timezone" VARCHAR(50),
    "contract_type" "ContractorContractType" NOT NULL,
    "package_fee" DECIMAL(15,2),
    "hourly_rate" DECIMAL(10,2),
    "monthly_fee" DECIMAL(15,2),
    "unit_fees" JSONB,
    "royalty_type" "RoyaltyType" NOT NULL DEFAULT 'NONE',
    "royalty_rate" DECIMAL(5,2),
    "royalty_minimum" DECIMAL(15,2),
    "royalty_minimum_currency" "Currency",
    "royalty_payment_cycle" VARCHAR(50),
    "tax_id" VARCHAR(50),
    "is_qualified_invoice_issuer" BOOLEAN NOT NULL DEFAULT false,
    "payment_term_type" "PaymentTermType" NOT NULL DEFAULT 'MONTHLY_CLOSING',
    "closing_day" INTEGER,
    "payment_days" INTEGER,
    "default_pattern_ownership" "OwnershipType" NOT NULL DEFAULT 'SHUNYA',
    "default_design_ownership" "OwnershipType" NOT NULL DEFAULT 'SHUNYA',
    "invited_user_id" TEXT,
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "client_id" TEXT,
    "buyer_code" VARCHAR(50) NOT NULL,
    "buyer_name" VARCHAR(255) NOT NULL,
    "buyer_name_en" VARCHAR(255),
    "address" TEXT,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_destinations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "destination_code" VARCHAR(50) NOT NULL,
    "destination_name" VARCHAR(255) NOT NULL,
    "postal_code" VARCHAR(20),
    "country" VARCHAR(2) NOT NULL DEFAULT 'JP',
    "prefecture" VARCHAR(50),
    "city" VARCHAR(100),
    "address" TEXT,
    "contact_person" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "delivery_notes" TEXT,
    "preferred_delivery_days" VARCHAR(255),
    "preferred_delivery_hours" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "delivery_destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "material_code" VARCHAR(50) NOT NULL,
    "material_name" VARCHAR(255) NOT NULL,
    "material_name_en" VARCHAR(255),
    "material_name_zh" VARCHAR(255),
    "material_name_vi" VARCHAR(255),
    "category_id" TEXT,
    "material_type" "MaterialType" NOT NULL,
    "primary_supplier_id" TEXT,
    "specification" TEXT,
    "fabric_weight" DECIMAL(8,2),
    "fabric_width" DECIMAL(8,2),
    "composition" TEXT,
    "composition_data" JSONB,
    "standard_usage" DECIMAL(8,4),
    "standard_loss_rate" DECIMAL(5,2),
    "unit_price" DECIMAL(15,4),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "unit" VARCHAR(20) NOT NULL,
    "minimum_order_qty" DECIMAL(15,2),
    "hs_code" VARCHAR(20),
    "origin_country" VARCHAR(2),
    "available_colors" JSONB,
    "image_url" VARCHAR(500),
    "swatch_image_url" VARCHAR(500),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_code" VARCHAR(50) NOT NULL,
    "category_name" VARCHAR(255) NOT NULL,
    "category_name_en" VARCHAR(255),
    "parent_category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_code" VARCHAR(10) NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "category_name_en" VARCHAR(100),
    "parent_category_id" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "standard_fabric_usage" DECIMAL(8,4),
    "standard_loss_rate" DECIMAL(5,2),
    "standard_sewing_fee" DECIMAL(10,2),
    "default_moq_tiers" JSONB,
    "default_size_options" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "expense_code" VARCHAR(50) NOT NULL,
    "expense_name" VARCHAR(255) NOT NULL,
    "expense_name_en" VARCHAR(255),
    "expense_type" "ExpenseType" NOT NULL,
    "standard_amount" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "calculation_type" "CalculationType" NOT NULL DEFAULT 'FIXED',
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "base_currency" "Currency" NOT NULL,
    "target_currency" "Currency" NOT NULL,
    "rate" DECIMAL(15,6) NOT NULL,
    "rate_date" DATE NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT 'BOJ',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hs_codes" (
    "id" TEXT NOT NULL,
    "hs_code" VARCHAR(20) NOT NULL,
    "description" TEXT NOT NULL,
    "description_en" TEXT,
    "description_zh" TEXT,
    "description_vi" TEXT,
    "parent_hs_code" VARCHAR(20),
    "chapter" VARCHAR(2),
    "tariff_rate" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hs_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fta_rules" (
    "id" TEXT NOT NULL,
    "fta_name" VARCHAR(100) NOT NULL,
    "fta_code" VARCHAR(50) NOT NULL,
    "exporting_country" VARCHAR(2) NOT NULL,
    "importing_country" VARCHAR(2) NOT NULL,
    "hs_code" VARCHAR(20),
    "origin_criteria" TEXT,
    "form_type" VARCHAR(50),
    "base_rate" DECIMAL(8,4),
    "preferential_rate" DECIMAL(8,4),
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fta_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_terms_glossary" (
    "id" TEXT NOT NULL,
    "term_code" VARCHAR(100) NOT NULL,
    "term_ja" VARCHAR(255) NOT NULL,
    "term_en" VARCHAR(255) NOT NULL,
    "term_zh" VARCHAR(255),
    "term_vi" VARCHAR(255),
    "description_ja" TEXT,
    "description_en" TEXT,
    "category" VARCHAR(100),
    "synonyms" JSONB,
    "tags" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_terms_glossary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "inquiry_number" VARCHAR(50) NOT NULL,
    "existing_client_id" TEXT,
    "client_company_name" VARCHAR(255) NOT NULL,
    "client_legal_entity" VARCHAR(255),
    "client_business_type" "ClientBusinessType",
    "client_size" "ClientSize",
    "contact_first_name" VARCHAR(100) NOT NULL,
    "contact_last_name" VARCHAR(100) NOT NULL,
    "contact_job_title" VARCHAR(255),
    "contact_department" VARCHAR(255),
    "contact_email" VARCHAR(255) NOT NULL,
    "contact_phone" VARCHAR(50),
    "contact_mobile" VARCHAR(50),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(2) NOT NULL DEFAULT 'JP',
    "prefecture" VARCHAR(50),
    "city" VARCHAR(100),
    "address" TEXT,
    "website" VARCHAR(500),
    "instagram" VARCHAR(255),
    "twitter" VARCHAR(255),
    "lead_source" "LeadSource" NOT NULL,
    "referrer" VARCHAR(255),
    "referrer_details" TEXT,
    "inquiry_content" TEXT NOT NULL,
    "inquiry_type" "InquiryType" NOT NULL DEFAULT 'GENERAL',
    "expected_items" TEXT,
    "expected_quantity" INTEGER,
    "expected_delivery" DATE,
    "expected_budget" DECIMAL(15,2),
    "expected_budget_currency" "Currency",
    "reference_files" JSONB,
    "status" "InquiryStatus" NOT NULL DEFAULT 'INITIAL_CONTACT',
    "loss_reason" "LossReason",
    "loss_reason_details" TEXT,
    "lost_at" TIMESTAMP(3),
    "paused_until" DATE,
    "paused_reason" TEXT,
    "converted_at" TIMESTAMP(3),
    "assigned_to_user_id" TEXT,
    "internal_notes" TEXT,
    "duplicate_check_hash" VARCHAR(64),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_contacted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_follow_ups" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "follow_up_date" TIMESTAMP(3) NOT NULL,
    "follow_up_type" VARCHAR(50) NOT NULL,
    "follow_up_content" TEXT NOT NULL,
    "outcome_notes" TEXT,
    "performed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_codes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "model_code" VARCHAR(50) NOT NULL,
    "brand_id" TEXT NOT NULL,
    "model_name" VARCHAR(255) NOT NULL,
    "model_name_en" VARCHAR(255),
    "description" TEXT,
    "category_id" TEXT,
    "silhouette" VARCHAR(100),
    "total_repetitions" INTEGER NOT NULL DEFAULT 0,
    "total_production_qty" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(15,2),
    "total_pattern_cost" DECIMAL(15,2),
    "total_design_cost" DECIMAL(15,2),
    "cost_per_unit" DECIMAL(15,4),
    "latest_product_id" TEXT,
    "has_pattern" BOOLEAN NOT NULL DEFAULT false,
    "has_grading" BOOLEAN NOT NULL DEFAULT false,
    "has_design" BOOLEAN NOT NULL DEFAULT false,
    "pattern_ownership" "OwnershipType" NOT NULL DEFAULT 'SHUNYA',
    "design_ownership" "OwnershipType" NOT NULL DEFAULT 'SHUNYA',
    "status" "ModelCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "first_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "model_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_code" VARCHAR(50) NOT NULL,
    "client_product_code" VARCHAR(50),
    "inquiry_id" TEXT,
    "model_code_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "category_id" TEXT,
    "product_name" VARCHAR(255) NOT NULL,
    "product_name_en" VARCHAR(255),
    "description" TEXT,
    "season" VARCHAR(20) NOT NULL,
    "year" SMALLINT NOT NULL,
    "silhouette" VARCHAR(100),
    "expected_quantity" INTEGER,
    "received_order_qty" INTEGER,
    "production_qty" INTEGER,
    "delivered_qty" INTEGER,
    "defect_qty" INTEGER,
    "defect_rate" DECIMAL(5,2),
    "sample_price" DECIMAL(15,2),
    "mass_unit_price" DECIMAL(15,2),
    "total_revenue" DECIMAL(15,2),
    "total_cost" DECIMAL(15,2),
    "gross_profit" DECIMAL(15,2),
    "gross_profit_rate" DECIMAL(5,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "status" "ProductStatus" NOT NULL DEFAULT 'PLANNING',
    "is_spec_locked" BOOLEAN NOT NULL DEFAULT false,
    "spec_locked_at" TIMESTAMP(3),
    "order_period_start" DATE,
    "order_period_end" DATE,
    "desired_delivery_date" DATE,
    "planned_delivery_date" DATE,
    "actual_delivery_date" DATE,
    "is_overseas_production" BOOLEAN NOT NULL DEFAULT false,
    "production_country" VARCHAR(2),
    "assigned_to_user_id" TEXT,
    "designer_id" TEXT,
    "pattern_maker_id" TEXT,
    "pattern_ownership" "OwnershipType",
    "design_ownership" "OwnershipType",
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_status_history" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "from_status" "ProductStatus",
    "to_status" "ProductStatus" NOT NULL,
    "changed_by_user_id" TEXT,
    "change_reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sku_code" VARCHAR(100) NOT NULL,
    "client_sku_code" VARCHAR(100),
    "color_code" VARCHAR(20) NOT NULL,
    "color_name" VARCHAR(100) NOT NULL,
    "color_name_en" VARCHAR(100),
    "color_hex" VARCHAR(7),
    "pantone" VARCHAR(50),
    "size" VARCHAR(20) NOT NULL,
    "size_order" INTEGER NOT NULL DEFAULT 0,
    "jan_code" VARCHAR(20),
    "ordered_quantity" INTEGER NOT NULL DEFAULT 0,
    "production_quantity" INTEGER NOT NULL DEFAULT 0,
    "produced_quantity" INTEGER NOT NULL DEFAULT 0,
    "delivered_quantity" INTEGER NOT NULL DEFAULT 0,
    "defect_quantity" INTEGER NOT NULL DEFAULT 0,
    "remaining_stock" INTEGER NOT NULL DEFAULT 0,
    "moq_status" "SkuMoqStatus" NOT NULL DEFAULT 'NOT_DETERMINED',
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "collection_code" VARCHAR(50) NOT NULL,
    "collection_name" VARCHAR(255) NOT NULL,
    "collection_name_en" VARCHAR(255),
    "client_id" TEXT,
    "brand_id" TEXT,
    "season" VARCHAR(20),
    "concept" TEXT,
    "description" TEXT,
    "product_count" INTEGER NOT NULL DEFAULT 0,
    "total_quantity" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" DECIMAL(15,2),
    "total_cost" DECIMAL(15,2),
    "total_gross_profit" DECIMAL(15,2),
    "contract_terms" TEXT,
    "deposit_amount" DECIMAL(15,2),
    "deposit_paid" BOOLEAN NOT NULL DEFAULT false,
    "status" "CollectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" DATE,
    "end_date" DATE,
    "assigned_to_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_products" (
    "id" TEXT NOT NULL,
    "collection_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "notes" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "added_by_user_id" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_repetition_lineage" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "model_code_id" TEXT NOT NULL,
    "parent_product_id" TEXT NOT NULL,
    "child_product_id" TEXT NOT NULL,
    "repetition_type" "RepetitionType" NOT NULL,
    "change_description" TEXT,
    "changes_data" JSONB,
    "based_on_spec_version" VARCHAR(20),
    "based_on_pattern_version" VARCHAR(20),
    "based_on_design_version" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,

    CONSTRAINT "product_repetition_lineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specifications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "base_version_id" TEXT,
    "status" "SpecificationStatus" NOT NULL DEFAULT 'DRAFT',
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "locked_by_user_id" TEXT,
    "pattern_version_id" TEXT,
    "design_version_id" TEXT,
    "spec_code" VARCHAR(50),
    "silhouette" VARCHAR(100),
    "sewing_method" TEXT,
    "stitch_spec" JSONB,
    "seam_allowance" TEXT,
    "size_spec" JSONB,
    "grading_rules" JSONB,
    "washing_spec" TEXT,
    "print_spec" JSONB,
    "embroidery_spec" JSONB,
    "special_processing" TEXT,
    "inspection_points" JSONB,
    "defect_criteria" JSONB,
    "tolerance_range" TEXT,
    "packaging" TEXT,
    "packaging_format" VARCHAR(100),
    "internal_remarks" TEXT,
    "factory_remarks" JSONB,
    "language" "Language" NOT NULL DEFAULT 'JA',
    "is_multilingual" BOOLEAN NOT NULL DEFAULT false,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "client_approved" BOOLEAN NOT NULL DEFAULT false,
    "client_approved_at" TIMESTAMP(3),
    "pdf_file_url" VARCHAR(500),
    "excel_file_url" VARCHAR(500),
    "revision_notes" TEXT,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specifications_multilingual" (
    "id" TEXT NOT NULL,
    "specification_id" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "translated_content" JSONB NOT NULL,
    "pdf_file_url" VARCHAR(500),
    "translated_by_ai" BOOLEAN NOT NULL DEFAULT true,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specifications_multilingual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "model_code_id" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "base_version_id" TEXT,
    "work_order_id" TEXT,
    "drive_file_url" VARCHAR(500),
    "drive_file_path" TEXT,
    "file_name" VARCHAR(255),
    "file_type" VARCHAR(50),
    "file_size" BIGINT,
    "thumbnail_url" VARCHAR(500),
    "contractor_id" TEXT,
    "created_by_user_id" TEXT,
    "work_type" "PatternWorkType" NOT NULL,
    "pattern_type" VARCHAR(100),
    "revision_notes" TEXT,
    "revision_items" JSONB,
    "has_grading" BOOLEAN NOT NULL DEFAULT false,
    "grading_sizes" JSONB,
    "storage_location" VARCHAR(255),
    "storage_notes" TEXT,
    "status" "PatternVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "pattern_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "model_code_id" TEXT NOT NULL,
    "product_id" TEXT,
    "version" VARCHAR(20) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "base_version_id" TEXT,
    "drive_file_url" VARCHAR(500),
    "drive_file_path" TEXT,
    "file_name" VARCHAR(255),
    "file_type" VARCHAR(50),
    "file_size" BIGINT,
    "thumbnail_url" VARCHAR(500),
    "flat_sketch_front_url" VARCHAR(500),
    "flat_sketch_back_url" VARCHAR(500),
    "detail_images" JSONB,
    "designer_id" TEXT,
    "external_designer_id" TEXT,
    "design_type" "DesignType" NOT NULL,
    "color_palette" JSONB,
    "revision_notes" TEXT,
    "revision_items" JSONB,
    "status" "DesignVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "client_approved" BOOLEAN NOT NULL DEFAULT false,
    "client_approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "design_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "specification_id" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "base_quantity" INTEGER NOT NULL DEFAULT 1,
    "total_material_cost" DECIMAL(15,2),
    "total_accessory_cost" DECIMAL(15,2),
    "total_cost_per_unit" DECIMAL(15,4),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "exchange_rate_data" JSONB,
    "status" "BomStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "material_id" TEXT,
    "custom_material_name" VARCHAR(255),
    "custom_material_name_en" VARCHAR(255),
    "item_category" "BomItemCategory" NOT NULL,
    "specification" TEXT,
    "composition" TEXT,
    "supplier_id" TEXT,
    "usage_per_unit" DECIMAL(10,4) NOT NULL,
    "loss_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total_usage_per_unit" DECIMAL(10,4),
    "unit" VARCHAR(20) NOT NULL,
    "color_code" VARCHAR(50),
    "color_name" VARCHAR(100),
    "pantone" VARCHAR(50),
    "unit_price" DECIMAL(15,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "cost_per_unit" DECIMAL(15,4),
    "hs_code" VARCHAR(20),
    "origin_country" VARCHAR(2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodboards" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "concept" TEXT,
    "description" TEXT,
    "brand_id" TEXT,
    "model_code_id" TEXT,
    "inquiry_id" TEXT,
    "product_id" TEXT,
    "collection_id" TEXT,
    "canvas_width" INTEGER NOT NULL DEFAULT 1920,
    "canvas_height" INTEGER NOT NULL DEFAULT 1080,
    "thumbnail_url" VARCHAR(500),
    "export_pdf_url" VARCHAR(500),
    "export_image_url" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "moodboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodboard_items" (
    "id" TEXT NOT NULL,
    "moodboard_id" TEXT NOT NULL,
    "item_type" "MoodboardItemType" NOT NULL,
    "position_x" DECIMAL(10,2) NOT NULL,
    "position_y" DECIMAL(10,2) NOT NULL,
    "width" DECIMAL(10,2) NOT NULL,
    "height" DECIMAL(10,2) NOT NULL,
    "rotation" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "image_url" VARCHAR(500),
    "text_content" TEXT,
    "color_hex" VARCHAR(7),
    "color_pantone" VARCHAR(50),
    "swatch_info" JSONB,
    "file_url" VARCHAR(500),
    "file_name" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moodboard_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_library" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "asset_code" VARCHAR(50),
    "asset_name" VARCHAR(255) NOT NULL,
    "asset_name_en" VARCHAR(255),
    "description" TEXT,
    "category" "AssetCategory" NOT NULL,
    "sub_category" VARCHAR(100),
    "file_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "file_name" VARCHAR(255),
    "file_type" VARCHAR(50),
    "file_size" BIGINT,
    "storage_location" "AssetStorageLocation" NOT NULL DEFAULT 'SYSTEM_R2',
    "color_hex" VARCHAR(7),
    "color_pantone" VARCHAR(50),
    "color_rgb" VARCHAR(50),
    "color_cmyk" VARCHAR(50),
    "font_family" VARCHAR(255),
    "font_license" TEXT,
    "font_license_expiry" DATE,
    "brand_id" TEXT,
    "model_code_id" TEXT,
    "product_category_id" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "copyright_owner" VARCHAR(255),
    "copyright_notes" TEXT,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "asset_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_tags" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tag_name" VARCHAR(100) NOT NULL,
    "tag_name_en" VARCHAR(100),
    "tag_color" VARCHAR(7),
    "category" VARCHAR(100),
    "description" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_tag_links" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photography_projects" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "project_code" VARCHAR(50) NOT NULL,
    "project_name" VARCHAR(255) NOT NULL,
    "client_id" TEXT,
    "brand_id" TEXT,
    "collection_id" TEXT,
    "shoot_type" "ShootType"[],
    "shoot_date" DATE NOT NULL,
    "shoot_start_time" VARCHAR(20),
    "shoot_end_time" VARCHAR(20),
    "location" VARCHAR(255),
    "location_address" TEXT,
    "photographer_name" VARCHAR(255),
    "stylist_name" VARCHAR(255),
    "hair_makeup_name" VARCHAR(255),
    "model_names" JSONB,
    "styling_concept" TEXT,
    "shot_list" JSONB,
    "raw_folder_url" VARCHAR(500),
    "edited_folder_url" VARCHAR(500),
    "final_folder_url" VARCHAR(500),
    "total_shots" INTEGER,
    "completed_shots" INTEGER NOT NULL DEFAULT 0,
    "retouch_progress" INTEGER NOT NULL DEFAULT 0,
    "delivery_date" DATE,
    "delivery_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "budget" DECIMAL(15,2),
    "actual_cost" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "status" "PhotographyStatus" NOT NULL DEFAULT 'PLANNING',
    "notes" TEXT,
    "assigned_to_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "photography_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photography_items" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "color_code" VARCHAR(50),
    "shoot_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "retouch_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "planned_shots" INTEGER,
    "completed_shots" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photography_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_files" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50),
    "file_size" BIGINT,
    "mime_type" VARCHAR(100),
    "storage_location" "AssetStorageLocation" NOT NULL DEFAULT 'SYSTEM_R2',
    "file_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "attached_to_type" VARCHAR(50) NOT NULL,
    "attached_to_id" VARCHAR(255) NOT NULL,
    "uploaded_by_user_id" TEXT,
    "uploaded_from_email" BOOLEAN NOT NULL DEFAULT false,
    "email_message_id" VARCHAR(255),
    "tags" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "shared_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "quotation_number" VARCHAR(50) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "base_version_id" TEXT,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "product_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "collection_id" TEXT,
    "inquiry_id" TEXT,
    "bom_id" TEXT,
    "bom_version" VARCHAR(20),
    "quotation_type" "QuotationType" NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "notes_for_client" TEXT,
    "internal_notes" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "exchange_rate_at_creation" DECIMAL(15,6),
    "exchange_rate_source" VARCHAR(50),
    "exchange_rate_date" DATE,
    "has_moq_tiers" BOOLEAN NOT NULL DEFAULT true,
    "sample_quantity" INTEGER,
    "sample_unit_price" DECIMAL(15,2),
    "expected_quantity" INTEGER,
    "expected_total" DECIMAL(15,2),
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "days_until_expiry" INTEGER,
    "is_expired" BOOLEAN NOT NULL DEFAULT false,
    "expired_at" TIMESTAMP(3),
    "fx_tolerance_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "fx_alert_triggered" BOOLEAN NOT NULL DEFAULT false,
    "fx_alert_at" TIMESTAMP(3),
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMP(3),
    "locked_by_user_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "submitted_by_user_id" TEXT,
    "approved_internally_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "client_approved_at" TIMESTAMP(3),
    "client_approval_notes" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "rejection_details" JSONB,
    "is_converted_to_order" BOOLEAN NOT NULL DEFAULT false,
    "converted_at" TIMESTAMP(3),
    "is_emergency_progressing" BOOLEAN NOT NULL DEFAULT false,
    "emergency_approved_by_user_id" TEXT,
    "emergency_approved_at" TIMESTAMP(3),
    "emergency_risk_acceptance" VARCHAR(50),
    "emergency_notes" TEXT,
    "show_internal_breakdown" BOOLEAN NOT NULL DEFAULT false,
    "display_language" "Language" NOT NULL DEFAULT 'JA',
    "created_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_moq_tiers" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "tier_order" INTEGER NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "max_quantity" INTEGER,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,
    "label" VARCHAR(100),
    "notes" TEXT,
    "total_at_min" DECIMAL(15,2),
    "total_at_max" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_moq_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_cost_breakdowns" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "external_category" "ExternalCostCategory" NOT NULL,
    "internal_category" "InternalCostCategory" NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "item_name_en" VARCHAR(255),
    "supplier_id" TEXT,
    "factory_id" TEXT,
    "contractor_id" TEXT,
    "material_id" TEXT,
    "expense_category_id" TEXT,
    "bom_item_id" TEXT,
    "quantity" DECIMAL(15,4),
    "unit" VARCHAR(20),
    "unit_price" DECIMAL(15,4),
    "calculation_type" "CalculationType" NOT NULL DEFAULT 'FIXED',
    "cost_amount" DECIMAL(15,4) NOT NULL,
    "cost_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "margin_rate" DECIMAL(5,2),
    "margin_amount" DECIMAL(15,4),
    "margin_source" "MarginSource",
    "selling_amount" DECIMAL(15,4),
    "cost_amount_jpy" DECIMAL(15,4),
    "selling_amount_jpy" DECIMAL(15,4),
    "exchange_rate_used" DECIMAL(15,6),
    "show_to_client" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_cost_breakdowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "margin_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "level" "MarginLevel" NOT NULL,
    "brand_id" TEXT,
    "product_id" TEXT,
    "external_category" "ExternalCostCategory",
    "internal_category" "InternalCostCategory",
    "margin_rate" DECIMAL(5,2) NOT NULL,
    "min_quantity" INTEGER,
    "max_quantity" INTEGER,
    "valid_from" DATE,
    "valid_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "margin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_approval_history" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "performed_by_user_id" TEXT,
    "performed_by_type" "ApprovalActorType" NOT NULL,
    "comment" TEXT,
    "attachments" JSONB,
    "from_status" "QuotationStatus",
    "to_status" "QuotationStatus",
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_approval_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_multilingual" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "translated_content" JSONB NOT NULL,
    "display_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "exchange_rate" DECIMAL(15,6),
    "pdf_file_url" VARCHAR(500),
    "pdf_generated_at" TIMESTAMP(3),
    "translated_by_ai" BOOLEAN NOT NULL DEFAULT true,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_multilingual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_pdf_outputs" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "output_type" "QuotationPdfType" NOT NULL,
    "language" "Language" NOT NULL,
    "currency" "Currency" NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" BIGINT,
    "snapshot_data" JSONB NOT NULL,
    "exchange_rate_at_output" DECIMAL(15,6),
    "sent_to" VARCHAR(255),
    "sent_at" TIMESTAMP(3),
    "generated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_pdf_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_conversions" (
    "id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "conversion_type" "ConversionType" NOT NULL DEFAULT 'DIRECT',
    "quoted_quantity" INTEGER,
    "actual_quantity" INTEGER,
    "quoted_unit_price" DECIMAL(15,2),
    "actual_unit_price" DECIMAL(15,2),
    "quoted_exchange_rate" DECIMAL(15,6),
    "actual_exchange_rate" DECIMAL(15,6),
    "fx_change_percent" DECIMAL(5,2),
    "price_change_reason" VARCHAR(100),
    "price_change_details" TEXT,
    "cost_impact" DECIMAL(15,2),
    "gross_profit_impact" DECIMAL(15,2),
    "notes" TEXT,
    "confirmed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "po_number" VARCHAR(50) NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "primary_product_id" TEXT,
    "po_type" "PurchaseOrderType" NOT NULL,
    "allocation_type" "AllocationType" NOT NULL,
    "email_subject" VARCHAR(500),
    "title" VARCHAR(255),
    "description" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "exchange_rate_at_order" DECIMAL(15,6),
    "subtotal" DECIMAL(15,2),
    "tax_amount" DECIMAL(15,2),
    "total_amount" DECIMAL(15,2),
    "total_amount_jpy" DECIMAL(15,2),
    "payment_term_type" "PaymentTermType",
    "payment_due_date" DATE,
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "bank_fee_amount" DECIMAL(15,2),
    "bank_fee_currency" "Currency",
    "expected_delivery_date" DATE,
    "actual_delivery_date" DATE,
    "is_delivery_delayed" BOOLEAN NOT NULL DEFAULT false,
    "delivery_address" TEXT,
    "delivery_notes" TEXT,
    "has_trade_documents" BOOLEAN NOT NULL DEFAULT false,
    "output_language" "Language" NOT NULL DEFAULT 'JA',
    "template_id" TEXT,
    "po_pdf_url" VARCHAR(500),
    "po_pdf_generated_at" TIMESTAMP(3),
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "sent_method" VARCHAR(50),
    "sent_to" VARCHAR(255),
    "sent_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledgment_notes" TEXT,
    "received_at" TIMESTAMP(3),
    "received_by_user_id" TEXT,
    "received_quality_check" TEXT,
    "last_status_check_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "internal_notes" TEXT,
    "supplier_notes" TEXT,
    "order_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_items" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "material_id" TEXT,
    "custom_item_name" VARCHAR(255),
    "custom_item_name_en" VARCHAR(255),
    "description" TEXT,
    "specification" TEXT,
    "color" VARCHAR(100),
    "color_code" VARCHAR(50),
    "pantone" VARCHAR(50),
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_price" DECIMAL(15,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "subtotal_jpy" DECIMAL(15,2),
    "hs_code" VARCHAR(20),
    "origin_country" VARCHAR(2),
    "received_quantity" DECIMAL(15,4),
    "shortage" DECIMAL(15,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "po_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "po_allocations" (
    "id" TEXT NOT NULL,
    "po_id" TEXT NOT NULL,
    "po_item_id" TEXT,
    "product_id" TEXT NOT NULL,
    "allocated_quantity" DECIMAL(15,4) NOT NULL,
    "allocated_amount" DECIMAL(15,2),
    "allocation_percent" DECIMAL(5,2),
    "allocation_reason" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "po_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "wo_number" VARCHAR(50) NOT NULL,
    "factory_id" TEXT,
    "contractor_id" TEXT,
    "product_id" TEXT,
    "model_code_id" TEXT,
    "work_type" "WorkOrderType" NOT NULL,
    "work_category" "WorkOrderCategory" NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "exchange_rate_at_order" DECIMAL(15,6),
    "subtotal" DECIMAL(15,2),
    "tax_amount" DECIMAL(15,2),
    "total_amount" DECIMAL(15,2),
    "total_amount_jpy" DECIMAL(15,2),
    "total_quantity" INTEGER,
    "is_cmt_contract" BOOLEAN NOT NULL DEFAULT false,
    "cmt_material_notes" TEXT,
    "specification_version" VARCHAR(20),
    "pattern_version_id" TEXT,
    "sample_production_id" TEXT,
    "sample_round" VARCHAR(10),
    "payment_term_type" "PaymentTermType",
    "payment_due_date" DATE,
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "expected_delivery_date" DATE,
    "actual_delivery_date" DATE,
    "is_delivery_delayed" BOOLEAN NOT NULL DEFAULT false,
    "delivery_address" TEXT,
    "has_trade_documents" BOOLEAN NOT NULL DEFAULT false,
    "output_language" "Language" NOT NULL DEFAULT 'JA',
    "template_id" TEXT,
    "wo_pdf_url" VARCHAR(500),
    "wo_pdf_generated_at" TIMESTAMP(3),
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "sent_method" VARCHAR(50),
    "sent_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_user_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledgment_notes" TEXT,
    "production_started_at" TIMESTAMP(3),
    "production_completed_at" TIMESTAMP(3),
    "completed_quantity" INTEGER,
    "defect_quantity" INTEGER,
    "royalty_amount" DECIMAL(15,2),
    "royalty_paid_at" TIMESTAMP(3),
    "last_status_check_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "internal_notes" TEXT,
    "factory_notes" TEXT,
    "order_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wo_items" (
    "id" TEXT NOT NULL,
    "wo_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "work_description" VARCHAR(500) NOT NULL,
    "sku_id" TEXT,
    "color_code" VARCHAR(50),
    "size" VARCHAR(20),
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT '枚',
    "unit_price" DECIMAL(15,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "subtotal_jpy" DECIMAL(15,2),
    "completed_quantity" INTEGER,
    "defect_quantity" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "so_number" VARCHAR(50) NOT NULL,
    "product_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "buyer_id" TEXT,
    "delivery_destination_id" TEXT,
    "quotation_id" TEXT,
    "quotation_version" VARCHAR(20),
    "source_type" "OrderSourceType" NOT NULL,
    "source_details" JSONB,
    "original_files" JSONB,
    "title" VARCHAR(255),
    "description" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "unit_price" DECIMAL(15,2),
    "applied_moq_tier_id" TEXT,
    "total_quantity" INTEGER NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(15,2),
    "tax_amount" DECIMAL(15,2),
    "total_amount" DECIMAL(15,2),
    "desired_delivery_date" DATE,
    "planned_delivery_date" DATE,
    "actual_delivery_date" DATE,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'TENTATIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "base_version_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_by_user_id" TEXT,
    "client_confirmed_at" TIMESTAMP(3),
    "client_confirmation_notes" TEXT,
    "is_converted_to_production" BOOLEAN NOT NULL DEFAULT false,
    "converted_at" TIMESTAMP(3),
    "buyer_order_number" VARCHAR(100),
    "buyer_special_requests" TEXT,
    "internal_notes" TEXT,
    "created_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "order_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "so_items" (
    "id" TEXT NOT NULL,
    "so_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "ordered_quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "delivery_destination_id" TEXT,
    "moq_status" "SkuMoqStatus" NOT NULL DEFAULT 'NOT_DETERMINED',
    "moq_decision_reason" TEXT,
    "production_quantity" INTEGER,
    "yield_rate" DECIMAL(5,2),
    "delivered_quantity" INTEGER NOT NULL DEFAULT 0,
    "remaining_quantity" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "so_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_change_history" (
    "id" TEXT NOT NULL,
    "so_id" TEXT NOT NULL,
    "change_type" "OrderChangeType" NOT NULL,
    "before_data" JSONB,
    "after_data" JSONB NOT NULL,
    "change_reason" TEXT,
    "is_client_request" BOOLEAN NOT NULL DEFAULT false,
    "client_request_notes" TEXT,
    "impact_analysis" JSONB,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "changed_by_user_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_change_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_pages" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "page_slug" VARCHAR(100) NOT NULL,
    "page_title" VARCHAR(255) NOT NULL,
    "page_title_en" VARCHAR(255),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "access_type" "OrderPageAccessType" NOT NULL DEFAULT 'LINK_ONLY',
    "password" VARCHAR(255),
    "open_from" TIMESTAMP(3),
    "open_until" TIMESTAMP(3),
    "show_moq_tiers" BOOLEAN NOT NULL DEFAULT true,
    "show_stock_info" BOOLEAN NOT NULL DEFAULT false,
    "allow_edit_after_submit" BOOLEAN NOT NULL DEFAULT true,
    "default_language" "Language" NOT NULL DEFAULT 'JA',
    "available_languages" "Language"[],
    "default_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "restricted_buyers" JSONB,
    "theme_color" VARCHAR(7),
    "header_image_url" VARCHAR(500),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "order_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_productions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "sample_number" VARCHAR(50) NOT NULL,
    "sample_round" "SampleRound" NOT NULL,
    "round_order" INTEGER NOT NULL,
    "parent_sample_id" TEXT,
    "title" VARCHAR(255),
    "description" TEXT,
    "specification_id" TEXT,
    "pattern_version_id" TEXT,
    "design_version_id" TEXT,
    "pattern_wo_id" TEXT,
    "sewing_wo_id" TEXT,
    "status" "SampleProductionStatus" NOT NULL DEFAULT 'PLANNING',
    "sample_quantity" INTEGER NOT NULL DEFAULT 1,
    "planned_start_date" DATE,
    "planned_completion_date" DATE,
    "actual_start_date" DATE,
    "actual_completion_date" DATE,
    "total_pattern_cost" DECIMAL(15,2),
    "total_material_cost" DECIMAL(15,2),
    "total_sewing_cost" DECIMAL(15,2),
    "total_revision_cost" DECIMAL(15,2),
    "total_cost" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "client_approved" BOOLEAN NOT NULL DEFAULT false,
    "client_approved_at" TIMESTAMP(3),
    "client_feedback" TEXT,
    "shipped_at" TIMESTAMP(3),
    "shipping_method" VARCHAR(50),
    "tracking_number" VARCHAR(100),
    "has_photo_record" BOOLEAN NOT NULL DEFAULT false,
    "photo_urls" JSONB,
    "internal_notes" TEXT,
    "created_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sample_productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_revisions" (
    "id" TEXT NOT NULL,
    "sample_production_id" TEXT NOT NULL,
    "revision_order" INTEGER NOT NULL,
    "revision_type" "SampleRevisionType" NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "photo_urls" JSONB,
    "attachments" JSONB,
    "requested_by" "RevisionRequestor" NOT NULL,
    "requested_by_user_id" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "completed_by_user_id" TEXT,
    "revision_wo_id" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sample_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_checks" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "target_type" "StatusCheckTargetType" NOT NULL,
    "supplier_id" TEXT,
    "factory_id" TEXT,
    "contractor_id" TEXT,
    "check_month" DATE NOT NULL,
    "target_ids" JSONB NOT NULL,
    "ai_draft_content" TEXT,
    "ai_draft_language" "Language" NOT NULL DEFAULT 'JA',
    "ai_generated_at" TIMESTAMP(3),
    "edited_content" TEXT,
    "edited_by_user_id" TEXT,
    "edited_at" TIMESTAMP(3),
    "is_sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "sent_to" VARCHAR(500),
    "sent_by_user_id" TEXT,
    "has_response" BOOLEAN NOT NULL DEFAULT false,
    "response_received_at" TIMESTAMP(3),
    "response_content" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_status_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_code" VARCHAR(50) NOT NULL,
    "location_name" VARCHAR(255) NOT NULL,
    "location_name_en" VARCHAR(255),
    "location_type" "StorageLocationType" NOT NULL,
    "supplier_id" TEXT,
    "factory_id" TEXT,
    "country" VARCHAR(2) NOT NULL DEFAULT 'JP',
    "postal_code" VARCHAR(20),
    "address" TEXT,
    "contact_person" VARCHAR(255),
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "total_capacity" DECIMAL(15,2),
    "capacity_unit" VARCHAR(20),
    "has_temperature_control" BOOLEAN NOT NULL DEFAULT false,
    "has_humidity_control" BOOLEAN NOT NULL DEFAULT false,
    "monthly_fee" DECIMAL(15,2),
    "fee_currency" "Currency",
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "lot_number" VARCHAR(100) NOT NULL,
    "internal_lot_code" VARCHAR(100),
    "material_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "storage_location_id" TEXT NOT NULL,
    "po_id" TEXT,
    "po_item_id" TEXT,
    "item_name" VARCHAR(255) NOT NULL,
    "item_name_en" VARCHAR(255),
    "color_code" VARCHAR(50),
    "color_name" VARCHAR(100),
    "pantone" VARCHAR(50),
    "specification" TEXT,
    "composition" TEXT,
    "original_quantity" DECIMAL(15,4) NOT NULL,
    "current_quantity" DECIMAL(15,4) NOT NULL,
    "reserved_quantity" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "available_quantity" DECIMAL(15,4),
    "unit" VARCHAR(20) NOT NULL,
    "unit_price" DECIMAL(15,4) NOT NULL,
    "total_cost" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "unit_price_jpy" DECIMAL(15,4),
    "total_cost_jpy" DECIMAL(15,2),
    "exchange_rate_at_receipt" DECIMAL(15,6),
    "received_date" DATE NOT NULL,
    "received_by_user_id" TEXT,
    "quality_check_status" VARCHAR(50),
    "quality_check_notes" TEXT,
    "quality_checked_at" TIMESTAMP(3),
    "expiry_date" DATE,
    "manufacture_date" DATE,
    "hs_code" VARCHAR(20),
    "origin_country" VARCHAR(2),
    "import_doc_number" VARCHAR(100),
    "status" "InventoryLotStatus" NOT NULL DEFAULT 'IN_STOCK',
    "has_quality_issue" BOOLEAN NOT NULL DEFAULT false,
    "has_shortage" BOOLEAN NOT NULL DEFAULT false,
    "is_low_stock" BOOLEAN NOT NULL DEFAULT false,
    "is_excess_stock" BOOLEAN NOT NULL DEFAULT false,
    "is_near_expiry" BOOLEAN NOT NULL DEFAULT false,
    "inventory_type" "InventoryType" NOT NULL DEFAULT 'STANDARD',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "inventory_lot_id" TEXT NOT NULL,
    "movement_type" "InventoryMovementType" NOT NULL,
    "movement_direction" "MovementDirection" NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_price_at_movement" DECIMAL(15,4),
    "total_value" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "quantity_before" DECIMAL(15,4),
    "quantity_after" DECIMAL(15,4),
    "from_location_id" TEXT,
    "to_location_id" TEXT,
    "product_id" TEXT,
    "sku_id" TEXT,
    "po_id" TEXT,
    "wo_id" TEXT,
    "so_id" TEXT,
    "sample_production_id" TEXT,
    "allocation_id" TEXT,
    "destination_type" VARCHAR(50),
    "destination_id" VARCHAR(255),
    "quality_check_passed" BOOLEAN,
    "quality_notes" TEXT,
    "reason" VARCHAR(255),
    "notes" TEXT,
    "performed_by_user_id" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_valuations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "valuation_date" DATE NOT NULL,
    "period_type" "ValuationPeriodType" NOT NULL,
    "valuation_method" "ValuationMethod" NOT NULL DEFAULT 'MOVING_AVERAGE',
    "total_lots" INTEGER NOT NULL DEFAULT 0,
    "total_quantity" DECIMAL(15,4),
    "total_value_jpy" DECIMAL(15,2) NOT NULL,
    "breakdown_by_type" JSONB,
    "breakdown_by_location" JSONB,
    "breakdown_by_category" JSONB,
    "exchange_rates_used" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_alerts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "alert_type" "InventoryAlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "inventory_lot_id" TEXT,
    "material_id" TEXT,
    "storage_location_id" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "recommended_action" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_user_id" TEXT,
    "acknowledgment_notes" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolution_notes" TEXT,
    "notified_at" TIMESTAMP(3),
    "notified_user_ids" JSONB,
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trigger_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_goods_inventory" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "storage_location_id" TEXT NOT NULL,
    "total_produced" INTEGER NOT NULL DEFAULT 0,
    "total_delivered" INTEGER NOT NULL DEFAULT 0,
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "reserved_stock" INTEGER NOT NULL DEFAULT 0,
    "available_stock" INTEGER NOT NULL DEFAULT 0,
    "defect_stock" INTEGER NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(15,4),
    "total_value" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "total_ordered" INTEGER,
    "fulfillment_rate" DECIMAL(5,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "last_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finished_goods_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_goods_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "finished_goods_id" TEXT NOT NULL,
    "movement_type" "FinishedGoodsMovementType" NOT NULL,
    "movement_direction" "MovementDirection" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "defect_quantity" INTEGER,
    "wo_id" TEXT,
    "so_id" TEXT,
    "delivery_note_id" TEXT,
    "delivery_destination_id" TEXT,
    "quality_check_passed" BOOLEAN,
    "quality_notes" TEXT,
    "defect_reason" TEXT,
    "reason" VARCHAR(255),
    "notes" TEXT,
    "performed_by_user_id" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finished_goods_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory_consigned_inventory" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "inventory_lot_id" TEXT,
    "product_id" TEXT,
    "item_name" VARCHAR(255) NOT NULL,
    "material_id" TEXT,
    "color_code" VARCHAR(50),
    "color_name" VARCHAR(100),
    "consigned_quantity" DECIMAL(15,4) NOT NULL,
    "consumed_quantity" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "remaining_quantity" DECIMAL(15,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_cost" DECIMAL(15,4) NOT NULL,
    "total_consigned_value" DECIMAL(15,2),
    "total_consumed_value" DECIMAL(15,2),
    "remaining_value" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "consigned_date" DATE NOT NULL,
    "consigned_wo_id" TEXT,
    "status" "FactoryConsignedStatus" NOT NULL DEFAULT 'ACTIVE',
    "returned_quantity" DECIMAL(15,4),
    "returned_date" DATE,
    "disposition_type" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "factory_consigned_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory_consumption_records" (
    "id" TEXT NOT NULL,
    "factory_consigned_id" TEXT NOT NULL,
    "consumed_quantity" DECIMAL(15,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "cogs_amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "product_id" TEXT,
    "wo_id" TEXT,
    "reported_by_factory" BOOLEAN NOT NULL DEFAULT true,
    "report_source" VARCHAR(100),
    "verified_by_user_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "consumed_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factory_consumption_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktakings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stocktaking_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "scope_type" "StocktakingScope" NOT NULL,
    "storage_location_ids" JSONB,
    "material_category_ids" JSONB,
    "scheduled_date" DATE NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "StocktakingStatus" NOT NULL DEFAULT 'PLANNED',
    "total_items_planned" INTEGER NOT NULL DEFAULT 0,
    "total_items_counted" INTEGER NOT NULL DEFAULT 0,
    "total_discrepancies" INTEGER NOT NULL DEFAULT 0,
    "total_increase_amount" DECIMAL(15,2),
    "total_decrease_amount" DECIMAL(15,2),
    "net_adjustment_amount" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "responsible_user_id" TEXT,
    "participant_user_ids" JSONB,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stocktakings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktaking_items" (
    "id" TEXT NOT NULL,
    "stocktaking_id" TEXT NOT NULL,
    "inventory_lot_id" TEXT NOT NULL,
    "system_quantity" DECIMAL(15,4) NOT NULL,
    "counted_quantity" DECIMAL(15,4),
    "unit" VARCHAR(20) NOT NULL,
    "discrepancy_quantity" DECIMAL(15,4),
    "discrepancy_value" DECIMAL(15,2),
    "discrepancy_reason" "DiscrepancyReason",
    "reason_details" TEXT,
    "adjustment_type" "AdjustmentType",
    "counted_by_user_id" TEXT,
    "counted_at" TIMESTAMP(3),
    "photo_urls" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocktaking_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surplus_dispositions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "inventory_lot_id" TEXT,
    "client_id" TEXT,
    "item_name" VARCHAR(255) NOT NULL,
    "surplus_quantity" DECIMAL(15,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_cost" DECIMAL(15,4) NOT NULL,
    "total_value" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "disposition_items" JSONB NOT NULL,
    "stock_return_qty" DECIMAL(15,4),
    "loss_entry_qty" DECIMAL(15,4),
    "client_buyback_qty" DECIMAL(15,4),
    "other_disposition_qty" DECIMAL(15,4),
    "buyback_unit_price" DECIMAL(15,2),
    "buyback_total_amount" DECIMAL(15,2),
    "buyback_invoice_id" TEXT,
    "loss_amount" DECIMAL(15,2),
    "loss_reason" VARCHAR(255),
    "new_inventory_lot_id" TEXT,
    "status" "SurplusDispositionStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "executed_by_user_id" TEXT,
    "executed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "surplus_dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "delivery_number" VARCHAR(50) NOT NULL,
    "product_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "buyer_id" TEXT,
    "delivery_destination_id" TEXT,
    "primary_so_id" TEXT,
    "related_so_ids" JSONB,
    "ship_from_address" TEXT NOT NULL,
    "ship_from_contact" VARCHAR(255),
    "ship_to_address" TEXT NOT NULL,
    "ship_to_contact" VARCHAR(255),
    "ship_to_phone" VARCHAR(50),
    "delivery_date" DATE NOT NULL,
    "expected_delivery_date" DATE,
    "total_quantity" INTEGER NOT NULL DEFAULT 0,
    "total_cartons" INTEGER,
    "total_weight" DECIMAL(15,2),
    "total_volume" DECIMAL(15,4),
    "show_amounts" BOOLEAN NOT NULL DEFAULT false,
    "subtotal_amount" DECIMAL(15,2),
    "tax_amount" DECIMAL(15,2),
    "total_amount" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "shipping_method" VARCHAR(100),
    "carrier_name" VARCHAR(255),
    "tracking_number" VARCHAR(100),
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "hs_code" VARCHAR(20),
    "delivery_instructions" TEXT,
    "packaging_instructions" TEXT,
    "output_language" "Language" NOT NULL DEFAULT 'JA',
    "template_id" TEXT,
    "pdf_file_url" VARCHAR(500),
    "pdf_generated_at" TIMESTAMP(3),
    "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "shipped_at" TIMESTAMP(3),
    "shipped_by_user_id" TEXT,
    "received_at" TIMESTAMP(3),
    "received_by_name" VARCHAR(255),
    "receipt_signature_url" VARCHAR(500),
    "acknowledgment_status" VARCHAR(50),
    "acknowledgment_notes" TEXT,
    "created_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "internal_notes" TEXT,
    "client_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note_items" (
    "id" TEXT NOT NULL,
    "delivery_note_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "sku_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "client_product_code" VARCHAR(50),
    "product_name" VARCHAR(255) NOT NULL,
    "color_code" VARCHAR(50),
    "color_name" VARCHAR(100),
    "size" VARCHAR(20),
    "jan_code" VARCHAR(20),
    "quantity" INTEGER NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT '枚',
    "unit_price" DECIMAL(15,2),
    "subtotal" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "so_id" TEXT,
    "so_item_id" TEXT,
    "wo_id" TEXT,
    "finished_goods_movement_id" TEXT,
    "carton_number" VARCHAR(50),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "delivery_note_id" TEXT,
    "shipment_number" VARCHAR(50) NOT NULL,
    "carrier_name" VARCHAR(255) NOT NULL,
    "carrier_code" VARCHAR(50),
    "service_type" VARCHAR(100),
    "tracking_number" VARCHAR(100),
    "tracking_url" VARCHAR(500),
    "shipped_date" DATE NOT NULL,
    "shipped_from_address" TEXT NOT NULL,
    "shipped_to_address" TEXT NOT NULL,
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "total_weight" DECIMAL(15,2),
    "total_cartons" INTEGER,
    "carton_details" JSONB,
    "shipping_cost" DECIMAL(15,2),
    "insurance_cost" DECIMAL(15,2),
    "total_cost" DECIMAL(15,2),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PREPARING',
    "picked_up_at" TIMESTAMP(3),
    "in_transit_at" TIMESTAMP(3),
    "out_for_delivery_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "received_by_name" VARCHAR(255),
    "delivery_proof_url" VARCHAR(500),
    "invoice_url" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "invoice_type" "InvoiceType" NOT NULL,
    "client_id" TEXT NOT NULL,
    "buyer_id" TEXT,
    "primary_so_id" TEXT,
    "related_so_ids" JSONB,
    "primary_delivery_note_id" TEXT,
    "related_delivery_note_ids" JSONB,
    "client_po_number" VARCHAR(100),
    "invoice_date" DATE NOT NULL,
    "payment_due_date" DATE NOT NULL,
    "issuer_name" VARCHAR(255) NOT NULL,
    "issuer_legal_entity" VARCHAR(255),
    "issuer_address" TEXT NOT NULL,
    "issuer_phone" VARCHAR(50),
    "issuer_email" VARCHAR(255),
    "issuer_tax_id" VARCHAR(50) NOT NULL,
    "bill_to_name" VARCHAR(255) NOT NULL,
    "bill_to_legal_entity" VARCHAR(255),
    "bill_to_address" TEXT NOT NULL,
    "bill_to_contact_person" VARCHAR(255),
    "bill_to_tax_id" VARCHAR(50),
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "exchange_rate" DECIMAL(15,6),
    "exchange_rate_date" DATE,
    "exchange_rate_source" VARCHAR(50),
    "subtotal" DECIMAL(15,2) NOT NULL,
    "taxable_amount_10" DECIMAL(15,2),
    "tax_amount_10" DECIMAL(15,2),
    "taxable_amount_8" DECIMAL(15,2),
    "tax_amount_8" DECIMAL(15,2),
    "exempt_amount" DECIMAL(15,2),
    "total_tax_amount" DECIMAL(15,2),
    "total_amount" DECIMAL(15,2) NOT NULL,
    "subtotal_jpy" DECIMAL(15,2),
    "total_amount_jpy" DECIMAL(15,2),
    "show_dual_currency" BOOLEAN NOT NULL DEFAULT false,
    "secondary_currency" "Currency",
    "total_amount_secondary" DECIMAL(15,2),
    "transaction_type" "InvoiceTransactionType" NOT NULL,
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "is_export" BOOLEAN NOT NULL DEFAULT false,
    "payment_method" "PaymentMethod",
    "bank_info" JSONB,
    "swift_code" VARCHAR(20),
    "iban" VARCHAR(50),
    "bank_fee_burden" "BankFeeBurden",
    "output_language" "Language" NOT NULL DEFAULT 'JA',
    "template_id" TEXT,
    "pdf_file_url" VARCHAR(500),
    "pdf_generated_at" TIMESTAMP(3),
    "pdf_file_url_en" VARCHAR(500),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(15,2),
    "is_fully_paid" BOOLEAN NOT NULL DEFAULT false,
    "fully_paid_at" TIMESTAMP(3),
    "fx_gain_loss_amount" DECIMAL(15,2),
    "sent_at" TIMESTAMP(3),
    "sent_by_user_id" TEXT,
    "sent_method" VARCHAR(50),
    "sent_to" VARCHAR(500),
    "acknowledged_at" TIMESTAMP(3),
    "acknowledgment_notes" TEXT,
    "discount_amount" DECIMAL(15,2),
    "discount_reason" TEXT,
    "created_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "internal_notes" TEXT,
    "client_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "product_id" TEXT,
    "sku_id" TEXT,
    "delivery_note_item_id" TEXT,
    "item_code" VARCHAR(100),
    "item_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "color_code" VARCHAR(50),
    "size" VARCHAR(20),
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT '枚',
    "unit_price" DECIMAL(15,4) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "tax_classification" "TaxClassification" NOT NULL,
    "tax_amount" DECIMAL(15,2),
    "is_qualified_purchase" BOOLEAN NOT NULL DEFAULT true,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "subtotal_jpy" DECIMAL(15,2),
    "discount_amount" DECIMAL(15,2),
    "discount_reason" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "payment_number" VARCHAR(50) NOT NULL,
    "payment_direction" "PaymentDirection" NOT NULL,
    "counterpart_type" "CounterpartType" NOT NULL,
    "counterpart_id" VARCHAR(255) NOT NULL,
    "counterpart_name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "exchange_rate" DECIMAL(15,6),
    "amount_jpy" DECIMAL(15,2),
    "payment_method" "PaymentMethod" NOT NULL,
    "bank_name" VARCHAR(255),
    "bank_account_number" VARCHAR(100),
    "swift_code" VARCHAR(20),
    "iban" VARCHAR(50),
    "fee_amount" DECIMAL(15,2),
    "fee_currency" "Currency",
    "fee_burden" "BankFeeBurden",
    "is_international" BOOLEAN NOT NULL DEFAULT false,
    "international_remittance_id" TEXT,
    "scheduled_date" DATE NOT NULL,
    "actual_payment_date" DATE,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reference_number" VARCHAR(100),
    "bank_reference" VARCHAR(100),
    "fx_gain_loss_amount" DECIMAL(15,2),
    "fx_gain_loss_calculated_at" TIMESTAMP(3),
    "related_invoice_ids" JSONB,
    "related_po_ids" JSONB,
    "related_wo_ids" JSONB,
    "attachments" JSONB,
    "receipt_url" VARCHAR(500),
    "internal_notes" TEXT,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "executed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "allocated_amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "allocated_amount_jpy" DECIMAL(15,2),
    "notes" TEXT,
    "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "international_remittances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "remittance_number" VARCHAR(50) NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "sender_name" VARCHAR(255) NOT NULL,
    "sender_address" TEXT,
    "sender_bank_name" VARCHAR(255),
    "sender_bank_country" VARCHAR(2),
    "sender_swift_code" VARCHAR(20),
    "sender_account" VARCHAR(100),
    "receiver_name" VARCHAR(255) NOT NULL,
    "receiver_address" TEXT,
    "receiver_bank_name" VARCHAR(255) NOT NULL,
    "receiver_bank_country" VARCHAR(2) NOT NULL,
    "receiver_swift_code" VARCHAR(20) NOT NULL,
    "receiver_account" VARCHAR(100) NOT NULL,
    "receiver_iban" VARCHAR(50),
    "intermediary_bank_name" VARCHAR(255),
    "intermediary_bank_swift" VARCHAR(20),
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "exchange_rate" DECIMAL(15,6),
    "amount_jpy" DECIMAL(15,2),
    "sender_bank_fee" DECIMAL(15,2),
    "sender_bank_fee_currency" "Currency",
    "receiver_bank_fee" DECIMAL(15,2),
    "receiver_bank_fee_currency" "Currency",
    "intermediary_fee" DECIMAL(15,2),
    "total_fees_jpy" DECIMAL(15,2),
    "fee_burden" "BankFeeBurden" NOT NULL,
    "purpose" VARCHAR(500),
    "purpose_code" VARCHAR(50),
    "status" "RemittanceStatus" NOT NULL DEFAULT 'INITIATED',
    "initiated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "arrived_at" TIMESTAMP(3),
    "arrival_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "arrival_confirmed_at" TIMESTAMP(3),
    "arrival_confirmed_by" VARCHAR(255),
    "arrival_difference" DECIMAL(15,2),
    "bank_reference_number" VARCHAR(100),
    "tracking_number" VARCHAR(100),
    "payment_id" TEXT,
    "remittance_receipt_url" VARCHAR(500),
    "bank_statement_url" VARCHAR(500),
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "international_remittances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "record_type" "FxRecordType" NOT NULL,
    "invoice_id" TEXT,
    "payment_id" TEXT,
    "po_id" TEXT,
    "wo_id" TEXT,
    "remittance_id" TEXT,
    "base_currency" "Currency" NOT NULL,
    "target_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "amount_in_base" DECIMAL(15,2) NOT NULL,
    "initial_rate" DECIMAL(15,6) NOT NULL,
    "final_rate" DECIMAL(15,6),
    "rate_difference" DECIMAL(15,6),
    "initial_amount_jpy" DECIMAL(15,2) NOT NULL,
    "final_amount_jpy" DECIMAL(15,2),
    "fx_gain_loss_amount" DECIMAL(15,2),
    "is_gain" BOOLEAN,
    "transaction_date" DATE NOT NULL,
    "settlement_date" DATE,
    "description" TEXT,
    "is_posted_to_accounting" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fx_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_classifications" (
    "id" TEXT NOT NULL,
    "classification_code" VARCHAR(50) NOT NULL,
    "name_ja" VARCHAR(255) NOT NULL,
    "name_en" VARCHAR(255),
    "description" TEXT,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "classification" "TaxClassification" NOT NULL,
    "applicable_scenarios" TEXT,
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_calculation_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "calculation_type" "TaxCalculationType" NOT NULL,
    "sales_taxable_amount_10" DECIMAL(15,2),
    "sales_tax_amount_10" DECIMAL(15,2),
    "sales_taxable_amount_8" DECIMAL(15,2),
    "sales_tax_amount_8" DECIMAL(15,2),
    "sales_exempt_amount" DECIMAL(15,2),
    "total_sales_tax" DECIMAL(15,2),
    "qualified_purchase_amount_10" DECIMAL(15,2),
    "qualified_purchase_tax_10" DECIMAL(15,2),
    "unqualified_purchase_amount" DECIMAL(15,2),
    "unqualified_purchase_tax_deductible" DECIMAL(15,2),
    "transition_measure_percent" DECIMAL(5,2),
    "total_purchase_tax_deductible" DECIMAL(15,2),
    "tax_payable_amount" DECIMAL(15,2),
    "details_json" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "finalized_at" TIMESTAMP(3),
    "finalized_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_calculation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transition_measure_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "po_id" TEXT,
    "wo_id" TEXT,
    "supplier_id" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "transaction_amount" DECIMAL(15,2) NOT NULL,
    "original_tax_amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'JPY',
    "is_qualified_supplier" BOOLEAN NOT NULL DEFAULT false,
    "deductible_percentage" DECIMAL(5,2) NOT NULL,
    "deductible_amount" DECIMAL(15,2) NOT NULL,
    "non_deductible_amount" DECIMAL(15,2) NOT NULL,
    "measure_period" VARCHAR(100) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transition_measure_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_transactions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_number" VARCHAR(50) NOT NULL,
    "trade_type" "TradeType" NOT NULL,
    "product_id" TEXT,
    "collection_id" TEXT,
    "po_id" TEXT,
    "wo_id" TEXT,
    "so_id" TEXT,
    "origin_country" VARCHAR(2) NOT NULL,
    "export_country" VARCHAR(2) NOT NULL,
    "import_country" VARCHAR(2) NOT NULL,
    "intermediary_countries" JSONB,
    "shipper_type" "PartyType" NOT NULL,
    "shipper_id" VARCHAR(255) NOT NULL,
    "shipper_name" VARCHAR(255) NOT NULL,
    "shipper_address" TEXT NOT NULL,
    "shipper_country" VARCHAR(2) NOT NULL,
    "shipper_tax_id" VARCHAR(50),
    "consignee_type" "PartyType" NOT NULL,
    "consignee_id" VARCHAR(255) NOT NULL,
    "consignee_name" VARCHAR(255) NOT NULL,
    "consignee_address" TEXT NOT NULL,
    "consignee_country" VARCHAR(2) NOT NULL,
    "consignee_tax_id" VARCHAR(50),
    "notify_party_name" VARCHAR(255),
    "notify_party_address" TEXT,
    "notify_party_contact" VARCHAR(255),
    "incoterm" "IncotermType" NOT NULL,
    "incoterm_location" VARCHAR(255),
    "transport_mode" "TransportMode" NOT NULL,
    "port_of_loading" VARCHAR(255),
    "port_of_discharge" VARCHAR(255),
    "place_of_receipt" VARCHAR(255),
    "place_of_delivery" VARCHAR(255),
    "shipment_date" DATE,
    "estimated_departure_date" DATE,
    "estimated_arrival_date" DATE,
    "actual_arrival_date" DATE,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "total_amount" DECIMAL(15,2),
    "total_amount_jpy" DECIMAL(15,2),
    "exchange_rate" DECIMAL(15,6),
    "total_gross_weight" DECIMAL(15,3),
    "total_net_weight" DECIMAL(15,3),
    "total_volume" DECIMAL(15,4),
    "total_packages" INTEGER,
    "fta_applicable" BOOLEAN NOT NULL DEFAULT false,
    "fta_name" VARCHAR(100),
    "fta_code" VARCHAR(50),
    "export_license_number" VARCHAR(100),
    "import_license_number" VARCHAR(100),
    "status" "TradeTransactionStatus" NOT NULL DEFAULT 'PLANNING',
    "created_by_user_id" TEXT,
    "assigned_to_user_id" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "trade_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT NOT NULL,
    "ci_number" VARCHAR(50) NOT NULL,
    "domestic_invoice_id" TEXT,
    "issue_date" DATE NOT NULL,
    "shipper_name" VARCHAR(255) NOT NULL,
    "shipper_address" TEXT NOT NULL,
    "shipper_country" VARCHAR(2) NOT NULL,
    "shipper_tax_id" VARCHAR(50),
    "consignee_name" VARCHAR(255) NOT NULL,
    "consignee_address" TEXT NOT NULL,
    "consignee_country" VARCHAR(2) NOT NULL,
    "consignee_tax_id" VARCHAR(50),
    "notify_party_name" VARCHAR(255),
    "notify_party_address" TEXT,
    "incoterm" "IncotermType" NOT NULL,
    "incoterm_location" VARCHAR(255),
    "payment_terms" VARCHAR(255),
    "port_of_loading" VARCHAR(255),
    "port_of_discharge" VARCHAR(255),
    "vessel_or_flight" VARCHAR(255),
    "bl_or_awb_number" VARCHAR(100),
    "shipment_date" DATE,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "freight_cost" DECIMAL(15,2),
    "insurance_cost" DECIMAL(15,2),
    "other_charges" DECIMAL(15,2),
    "total_amount" DECIMAL(15,2) NOT NULL,
    "exchange_rate" DECIMAL(15,6),
    "total_amount_jpy" DECIMAL(15,2),
    "country_of_origin" VARCHAR(2),
    "lc_number" VARCHAR(100),
    "lc_issuing_bank" VARCHAR(255),
    "language" "Language" NOT NULL DEFAULT 'EN',
    "template_id" TEXT,
    "pdf_file_url" VARCHAR(500),
    "pdf_generated_at" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "signature_url" VARCHAR(500),
    "signed_by_user_id" TEXT,
    "signed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "commercial_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_invoice_items" (
    "id" TEXT NOT NULL,
    "commercial_invoice_id" TEXT NOT NULL,
    "item_order" INTEGER NOT NULL,
    "product_id" TEXT,
    "sku_id" TEXT,
    "item_description" TEXT NOT NULL,
    "item_code" VARCHAR(100),
    "hs_code" VARCHAR(20) NOT NULL,
    "country_of_origin" VARCHAR(2) NOT NULL,
    "composition" TEXT,
    "quantity" DECIMAL(15,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unit_price" DECIMAL(15,4) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "net_weight_per_unit" DECIMAL(10,4),
    "gross_weight_per_unit" DECIMAL(10,4),
    "total_net_weight" DECIMAL(15,3),
    "total_gross_weight" DECIMAL(15,3),
    "total_volume" DECIMAL(15,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_lists" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT NOT NULL,
    "commercial_invoice_id" TEXT,
    "pl_number" VARCHAR(50) NOT NULL,
    "issue_date" DATE NOT NULL,
    "shipper_name" VARCHAR(255) NOT NULL,
    "shipper_address" TEXT NOT NULL,
    "consignee_name" VARCHAR(255) NOT NULL,
    "consignee_address" TEXT NOT NULL,
    "port_of_loading" VARCHAR(255),
    "port_of_discharge" VARCHAR(255),
    "vessel_or_flight" VARCHAR(255),
    "bl_or_awb_number" VARCHAR(100),
    "shipment_date" DATE,
    "total_cartons" INTEGER NOT NULL,
    "total_packages" INTEGER,
    "total_net_weight" DECIMAL(15,3) NOT NULL,
    "total_gross_weight" DECIMAL(15,3) NOT NULL,
    "total_volume" DECIMAL(15,4),
    "shipping_marks" TEXT,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "pdf_file_url" VARCHAR(500),
    "pdf_generated_at" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "packing_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_list_items" (
    "id" TEXT NOT NULL,
    "packing_list_id" TEXT NOT NULL,
    "carton_number" VARCHAR(50) NOT NULL,
    "from_carton_number" INTEGER,
    "to_carton_number" INTEGER,
    "product_id" TEXT,
    "sku_id" TEXT,
    "item_description" TEXT NOT NULL,
    "item_code" VARCHAR(100),
    "color_breakdown" JSONB,
    "quantity_per_carton" INTEGER NOT NULL,
    "total_cartons" INTEGER NOT NULL,
    "total_quantity" INTEGER NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'PCS',
    "net_weight_per_carton" DECIMAL(10,3) NOT NULL,
    "gross_weight_per_carton" DECIMAL(10,3) NOT NULL,
    "total_net_weight" DECIMAL(15,3) NOT NULL,
    "total_gross_weight" DECIMAL(15,3) NOT NULL,
    "carton_dimensions" VARCHAR(100),
    "carton_volume" DECIMAL(10,4),
    "total_volume" DECIMAL(15,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates_of_origin" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT NOT NULL,
    "co_number" VARCHAR(50) NOT NULL,
    "co_type" "CertificateOfOriginType" NOT NULL,
    "fta_name" VARCHAR(100),
    "fta_code" VARCHAR(50),
    "form_type" VARCHAR(50),
    "issuing_authority" VARCHAR(255) NOT NULL,
    "issuing_country" VARCHAR(2) NOT NULL,
    "issue_date" DATE NOT NULL,
    "valid_until" DATE,
    "exporter_name" VARCHAR(255) NOT NULL,
    "exporter_address" TEXT NOT NULL,
    "exporter_country" VARCHAR(2) NOT NULL,
    "exporter_tax_id" VARCHAR(50),
    "importer_name" VARCHAR(255) NOT NULL,
    "importer_address" TEXT NOT NULL,
    "importer_country" VARCHAR(2) NOT NULL,
    "importer_tax_id" VARCHAR(50),
    "commercial_invoice_id" TEXT,
    "ci_number" VARCHAR(50),
    "vessel_or_flight" VARCHAR(255),
    "port_of_loading" VARCHAR(255),
    "port_of_discharge" VARCHAR(255),
    "bl_or_awb_number" VARCHAR(100),
    "shipment_date" DATE,
    "items_data" JSONB NOT NULL,
    "origin_criteria" VARCHAR(255),
    "language" "Language" NOT NULL DEFAULT 'EN',
    "pdf_file_url" VARCHAR(500),
    "scan_file_url" VARCHAR(500),
    "status" "CertificateStatus" NOT NULL DEFAULT 'APPLIED',
    "application_date" DATE,
    "received_date" DATE,
    "created_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "certificates_of_origin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fta_applications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT NOT NULL,
    "certificate_of_origin_id" TEXT,
    "fta_name" VARCHAR(100) NOT NULL,
    "fta_code" VARCHAR(50) NOT NULL,
    "fta_rule_id" TEXT,
    "items_data" JSONB NOT NULL,
    "total_value_before_preference" DECIMAL(15,2) NOT NULL,
    "base_tariff_amount" DECIMAL(15,2) NOT NULL,
    "preferential_tariff_amount" DECIMAL(15,2) NOT NULL,
    "tariff_saved_amount" DECIMAL(15,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "tariff_saved_amount_jpy" DECIMAL(15,2),
    "application_date" DATE NOT NULL,
    "origin_criteria_used" VARCHAR(255),
    "criteria_justification" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by_user_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fta_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills_of_lading" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT NOT NULL,
    "bl_number" VARCHAR(100) NOT NULL,
    "bl_type" "BillOfLadingType" NOT NULL,
    "shipping_line_name" VARCHAR(255) NOT NULL,
    "shipping_line_code" VARCHAR(50),
    "vessel_name" VARCHAR(255) NOT NULL,
    "voyage_number" VARCHAR(50),
    "shipper_name" VARCHAR(255) NOT NULL,
    "shipper_address" TEXT NOT NULL,
    "consignee_name" VARCHAR(255) NOT NULL,
    "consignee_address" TEXT NOT NULL,
    "notify_party_name" VARCHAR(255),
    "notify_party_address" TEXT,
    "port_of_loading" VARCHAR(255) NOT NULL,
    "port_of_discharge" VARCHAR(255) NOT NULL,
    "place_of_receipt" VARCHAR(255),
    "place_of_delivery" VARCHAR(255),
    "shipment_date" DATE NOT NULL,
    "estimated_arrival_date" DATE,
    "actual_arrival_date" DATE,
    "container_numbers" JSONB,
    "container_count" INTEGER,
    "cargo_description" TEXT,
    "total_packages" INTEGER NOT NULL,
    "total_gross_weight" DECIMAL(15,3) NOT NULL,
    "total_volume" DECIMAL(15,4),
    "freight_term" VARCHAR(50),
    "freight_amount" DECIMAL(15,2),
    "freight_currency" "Currency",
    "pdf_file_url" VARCHAR(500),
    "original_scan_url" VARCHAR(500),
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "originals_received" BOOLEAN NOT NULL DEFAULT false,
    "originals_received_at" TIMESTAMP(3),
    "originals_count" INTEGER,
    "is_telex_release" BOOLEAN NOT NULL DEFAULT false,
    "telex_release_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bills_of_lading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "air_waybills" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT NOT NULL,
    "awb_number" VARCHAR(100) NOT NULL,
    "awb_type" "AirWaybillType" NOT NULL,
    "airline_name" VARCHAR(255) NOT NULL,
    "airline_code" VARCHAR(10),
    "flight_number" VARCHAR(20),
    "shipper_name" VARCHAR(255) NOT NULL,
    "shipper_address" TEXT NOT NULL,
    "consignee_name" VARCHAR(255) NOT NULL,
    "consignee_address" TEXT NOT NULL,
    "airport_of_departure" VARCHAR(255) NOT NULL,
    "airport_of_destination" VARCHAR(255) NOT NULL,
    "shipment_date" DATE NOT NULL,
    "estimated_arrival_date" DATE,
    "actual_arrival_date" DATE,
    "cargo_description" TEXT,
    "total_pieces" INTEGER NOT NULL,
    "total_gross_weight" DECIMAL(15,3) NOT NULL,
    "chargeable_weight" DECIMAL(15,3),
    "total_volume" DECIMAL(15,4),
    "freight_term" VARCHAR(50),
    "freight_amount" DECIMAL(15,2),
    "freight_currency" "Currency",
    "pdf_file_url" VARCHAR(500),
    "original_scan_url" VARCHAR(500),
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "air_waybills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_declarations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT NOT NULL,
    "declaration_number" VARCHAR(100) NOT NULL,
    "declaration_type" "CustomsDeclarationType" NOT NULL,
    "customs_broker_id" TEXT,
    "customs_broker_name" VARCHAR(255) NOT NULL,
    "broker_contact_name" VARCHAR(255),
    "broker_email" VARCHAR(255),
    "broker_phone" VARCHAR(50),
    "customs_country" VARCHAR(2) NOT NULL,
    "customs_office" VARCHAR(255),
    "declaration_date" DATE NOT NULL,
    "clearance_date" DATE,
    "total_declared_value" DECIMAL(15,2),
    "declared_currency" "Currency",
    "total_tariff_amount" DECIMAL(15,2),
    "total_consumption_tax" DECIMAL(15,2),
    "other_duties" DECIMAL(15,2),
    "total_duties_paid" DECIMAL(15,2),
    "broker_fee" DECIMAL(15,2),
    "broker_fee_currency" "Currency",
    "fta_applied" BOOLEAN NOT NULL DEFAULT false,
    "fta_application_id" TEXT,
    "related_documents" JSONB,
    "status" "CustomsDeclarationStatus" NOT NULL DEFAULT 'PREPARING',
    "inspection_required" BOOLEAN NOT NULL DEFAULT false,
    "inspection_date" DATE,
    "inspection_result" TEXT,
    "declaration_form_url" VARCHAR(500),
    "receipt_url" VARCHAR(500),
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customs_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_document_files" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT NOT NULL,
    "document_type" "TradeDocumentType" NOT NULL,
    "related_document_id" VARCHAR(255),
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50),
    "file_size" BIGINT,
    "file_url" VARCHAR(500) NOT NULL,
    "thumbnail_url" VARCHAR(500),
    "storage_location" "AssetStorageLocation" NOT NULL DEFAULT 'SYSTEM_R2',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "document_number" VARCHAR(100),
    "issue_date" DATE,
    "is_original" BOOLEAN NOT NULL DEFAULT false,
    "language" "Language",
    "uploaded_by_user_id" TEXT,
    "upload_source" VARCHAR(50),
    "email_message_id" VARCHAR(255),
    "tags" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "trade_document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_export_compliance_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "trade_transaction_id" TEXT,
    "check_type" "ComplianceCheckType" NOT NULL,
    "target_country" VARCHAR(2),
    "target_party" VARCHAR(255),
    "target_items" JSONB,
    "status" "ComplianceStatus" NOT NULL,
    "result" TEXT,
    "warnings" JSONB,
    "applicable_regulations" JSONB,
    "sanctions_check_result" TEXT,
    "sanctions_check_date" TIMESTAMP(3),
    "required_licenses" JSONB,
    "performed_by_user_id" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_export_compliance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "attached_to_type" VARCHAR(50) NOT NULL,
    "attached_to_id" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "content_format" "CommentFormat" NOT NULL DEFAULT 'MARKDOWN',
    "parent_comment_id" TEXT,
    "thread_root_id" TEXT,
    "author_user_id" TEXT NOT NULL,
    "author_role" "UserRole" NOT NULL,
    "is_external_author" BOOLEAN NOT NULL DEFAULT false,
    "comment_type" "CommentType" NOT NULL DEFAULT 'GENERAL',
    "priority" "CommentPriority" NOT NULL DEFAULT 'NORMAL',
    "attachments" JSONB,
    "mentioned_user_ids" JSONB,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_at" TIMESTAMP(3),
    "original_content" TEXT,
    "reactions" JSONB,
    "language" "Language" NOT NULL DEFAULT 'JA',
    "translations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_mentions" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "mentioned_user_id" TEXT NOT NULL,
    "is_notified" BOOLEAN NOT NULL DEFAULT false,
    "notified_at" TIMESTAMP(3),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "action_url" VARCHAR(500),
    "action_label" VARCHAR(100),
    "related_entity_type" VARCHAR(50),
    "related_entity_id" VARCHAR(255),
    "metadata" JSONB,
    "channels" "NotificationChannel"[],
    "delivery_status" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "is_actioned" BOOLEAN NOT NULL DEFAULT false,
    "actioned_at" TIMESTAMP(3),
    "auto_dismiss_after" INTEGER,
    "dismissed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "language" "Language" NOT NULL DEFAULT 'JA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT false,
    "slack_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" VARCHAR(5),
    "quiet_hours_end" VARCHAR(5),
    "minimum_priority" "NotificationPriority" NOT NULL DEFAULT 'LOW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "message_id" VARCHAR(500) NOT NULL,
    "thread_id" VARCHAR(500),
    "from_email" VARCHAR(255) NOT NULL,
    "from_name" VARCHAR(255),
    "to_emails" JSONB NOT NULL,
    "cc_emails" JSONB,
    "bcc_emails" JSONB,
    "reply_to_email" VARCHAR(255),
    "subject" TEXT NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "snippet" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "direction" "EmailDirection" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'UNPROCESSED',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "is_important" BOOLEAN NOT NULL DEFAULT false,
    "detected_language" "Language",
    "ai_classification" "EmailClassification",
    "ai_confidence" DECIMAL(5,4),
    "ai_processing_level" INTEGER,
    "ai_summary" TEXT,
    "ai_suggested_action" TEXT,
    "ai_keywords" JSONB,
    "ai_sentiment" VARCHAR(50),
    "related_entities" JSONB,
    "assigned_to_user_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "labels" JSONB,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "is_replied" BOOLEAN NOT NULL DEFAULT false,
    "replied_at" TIMESTAMP(3),
    "reply_message_id" VARCHAR(500),
    "ai_draft_reply" TEXT,
    "ai_draft_reply_language" "Language",
    "ai_draft_reply_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "email_message_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50),
    "file_size" BIGINT,
    "mime_type" VARCHAR(100),
    "file_url" VARCHAR(500) NOT NULL,
    "storage_location" "AssetStorageLocation" NOT NULL DEFAULT 'SYSTEM_R2',
    "downloaded_at" TIMESTAMP(3),
    "ai_content_type" VARCHAR(100),
    "ai_extracted_data" JSONB,
    "attached_to_type" VARCHAR(50),
    "attached_to_id" VARCHAR(255),
    "drive_uploaded_at" TIMESTAMP(3),
    "drive_file_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_classification_logs" (
    "id" TEXT NOT NULL,
    "email_message_id" TEXT NOT NULL,
    "processing_level" INTEGER NOT NULL,
    "classification_method" "ClassificationMethod" NOT NULL,
    "model_used" VARCHAR(100),
    "input_data" JSONB,
    "classification_result" "EmailClassification",
    "confidence" DECIMAL(5,4),
    "reasoning" TEXT,
    "tokens_used" INTEGER,
    "cost_amount" DECIMAL(10,6),
    "cost_currency" "Currency" NOT NULL DEFAULT 'USD',
    "processing_time_ms" INTEGER,
    "has_error" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_classification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_processing_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "processing_type" "AiProcessingType" NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "model_version" VARCHAR(50),
    "related_entity_type" VARCHAR(50),
    "related_entity_id" VARCHAR(255),
    "prompt_type" VARCHAR(100),
    "input_tokens" INTEGER,
    "input_data" JSONB,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "output_data" JSONB,
    "input_cost_usd" DECIMAL(10,6),
    "output_cost_usd" DECIMAL(10,6),
    "total_cost_usd" DECIMAL(10,6),
    "total_cost_jpy" DECIMAL(15,4),
    "processing_time_ms" INTEGER,
    "is_successful" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "triggered_by_user_id" TEXT,
    "is_automated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_translation_records" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "source_language" "Language" NOT NULL,
    "target_language" "Language" NOT NULL,
    "attached_to_type" VARCHAR(50),
    "attached_to_id" VARCHAR(255),
    "source_text" TEXT NOT NULL,
    "source_text_hash" VARCHAR(64),
    "translated_text" TEXT NOT NULL,
    "glossary_terms_used" JSONB,
    "ai_processing_log_id" TEXT,
    "model_used" VARCHAR(100),
    "quality_score" DECIMAL(5,4),
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewer_notes" TEXT,
    "corrected_text" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_translation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_transcripts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "meeting_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER,
    "meeting_type" "MeetingType" NOT NULL,
    "participants" JSONB NOT NULL,
    "related_product_ids" JSONB,
    "related_client_ids" JSONB,
    "audio_file_url" VARCHAR(500),
    "video_file_url" VARCHAR(500),
    "raw_transcript" TEXT,
    "formatted_transcript" TEXT,
    "language" "Language" NOT NULL DEFAULT 'JA',
    "is_multilingual" BOOLEAN NOT NULL DEFAULT false,
    "translations" JSONB,
    "ai_summary" TEXT,
    "ai_action_items" JSONB,
    "ai_decisions" JSONB,
    "ai_keywords" JSONB,
    "detected_changes" JSONB,
    "edited_summary" TEXT,
    "edited_by_user_id" TEXT,
    "edited_at" TIMESTAMP(3),
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'INTERNAL',
    "status" "MeetingTranscriptStatus" NOT NULL DEFAULT 'DRAFT',
    "pdf_file_url" VARCHAR(500),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "meeting_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "template_name" VARCHAR(255) NOT NULL,
    "template_name_en" VARCHAR(255),
    "description" TEXT,
    "template_type" "DocumentTemplateType" NOT NULL,
    "level" "TemplateLevel" NOT NULL,
    "client_id" TEXT,
    "supplier_id" TEXT,
    "brand_id" TEXT,
    "template_content" JSONB NOT NULL,
    "layout_config" JSONB,
    "style_config" JSONB,
    "logo_url" VARCHAR(500),
    "header_image_url" VARCHAR(500),
    "supported_languages" "Language"[],
    "default_language" "Language" NOT NULL DEFAULT 'JA',
    "supported_currencies" "Currency"[],
    "default_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "base_template_id" TEXT,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "default_language" "Language" NOT NULL DEFAULT 'JA',
    "default_currency" "Currency" NOT NULL DEFAULT 'JPY',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Tokyo',
    "fiscal_year_start" INTEGER NOT NULL DEFAULT 4,
    "exchange_rate_source" VARCHAR(50) NOT NULL DEFAULT 'BOJ',
    "numbering_rules" JSONB NOT NULL,
    "email_settings" JSONB NOT NULL,
    "fx_alert_threshold" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "low_stock_threshold_days" INTEGER NOT NULL DEFAULT 14,
    "expiry_warning_days" JSONB NOT NULL,
    "default_yield_rate" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "quotation_validity_days" JSONB NOT NULL,
    "automation_settings" JSONB NOT NULL,
    "ai_settings" JSONB NOT NULL,
    "security_settings" JSONB NOT NULL,
    "ui_preferences" JSONB,
    "custom_fields" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configurations" (
    "id" TEXT NOT NULL,
    "config_key" VARCHAR(255) NOT NULL,
    "config_value" JSONB NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_editable" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_import_jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "job_number" VARCHAR(50) NOT NULL,
    "target_entity" "ImportTargetEntity" NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_size" BIGINT,
    "has_header_row" BOOLEAN NOT NULL DEFAULT true,
    "delimiter" VARCHAR(5) NOT NULL DEFAULT ',',
    "encoding" VARCHAR(20) NOT NULL DEFAULT 'UTF-8',
    "column_mapping" JSONB NOT NULL,
    "total_rows" INTEGER,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "initiated_by_user_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "job_number" VARCHAR(50) NOT NULL,
    "target_entity" VARCHAR(100) NOT NULL,
    "filters" JSONB,
    "export_format" "ExportFormat" NOT NULL,
    "output_file_name" VARCHAR(255),
    "output_file_url" VARCHAR(500),
    "output_file_size" BIGINT,
    "total_rows" INTEGER,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "initiated_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_integrations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "service_name" VARCHAR(100) NOT NULL,
    "service_type" "IntegrationServiceType" NOT NULL,
    "auth_type" VARCHAR(50),
    "credentials_encrypted" TEXT,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "last_connected_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_error_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "total_sync_count" INTEGER NOT NULL DEFAULT 0,
    "success_sync_count" INTEGER NOT NULL DEFAULT 0,
    "failed_sync_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "external_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "source" VARCHAR(255) NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "request_method" VARCHAR(10) NOT NULL,
    "request_url" VARCHAR(1000) NOT NULL,
    "request_headers" JSONB,
    "request_body" JSONB,
    "response_status" INTEGER,
    "response_body" TEXT,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "related_entity_type" VARCHAR(50),
    "related_entity_id" VARCHAR(255),
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_tenant_type_idx" ON "companies"("tenant_type");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_role_idx" ON "users"("company_id", "role");

-- CreateIndex
CREATE INDEX "users_company_id_status_idx" ON "users"("company_id", "status");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_login_history_user_id_login_at_idx" ON "user_login_history"("user_id", "login_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_is_privileged_access_idx" ON "audit_logs"("is_privileged_access");

-- CreateIndex
CREATE INDEX "clients_company_id_status_idx" ON "clients"("company_id", "status");

-- CreateIndex
CREATE INDEX "clients_company_id_business_type_idx" ON "clients"("company_id", "business_type");

-- CreateIndex
CREATE INDEX "clients_company_id_lead_source_idx" ON "clients"("company_id", "lead_source");

-- CreateIndex
CREATE INDEX "clients_company_id_country_idx" ON "clients"("company_id", "country");

-- CreateIndex
CREATE UNIQUE INDEX "clients_company_id_client_code_key" ON "clients"("company_id", "client_code");

-- CreateIndex
CREATE INDEX "client_contacts_client_id_is_primary_idx" ON "client_contacts"("client_id", "is_primary");

-- CreateIndex
CREATE INDEX "brands_client_id_idx" ON "brands"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_company_id_brand_code_key" ON "brands"("company_id", "brand_code");

-- CreateIndex
CREATE INDEX "suppliers_company_id_status_idx" ON "suppliers"("company_id", "status");

-- CreateIndex
CREATE INDEX "suppliers_company_id_country_idx" ON "suppliers"("company_id", "country");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_company_id_supplier_code_key" ON "suppliers"("company_id", "supplier_code");

-- CreateIndex
CREATE INDEX "supplier_contacts_supplier_id_idx" ON "supplier_contacts"("supplier_id");

-- CreateIndex
CREATE INDEX "factories_company_id_status_idx" ON "factories"("company_id", "status");

-- CreateIndex
CREATE INDEX "factories_company_id_country_idx" ON "factories"("company_id", "country");

-- CreateIndex
CREATE UNIQUE INDEX "factories_company_id_factory_code_key" ON "factories"("company_id", "factory_code");

-- CreateIndex
CREATE INDEX "factory_contacts_factory_id_idx" ON "factory_contacts"("factory_id");

-- CreateIndex
CREATE INDEX "contractors_company_id_status_idx" ON "contractors"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contractors_company_id_contractor_code_key" ON "contractors"("company_id", "contractor_code");

-- CreateIndex
CREATE INDEX "buyers_company_id_client_id_idx" ON "buyers"("company_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyers_company_id_buyer_code_key" ON "buyers"("company_id", "buyer_code");

-- CreateIndex
CREATE INDEX "delivery_destinations_company_id_buyer_id_idx" ON "delivery_destinations"("company_id", "buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_destinations_company_id_destination_code_key" ON "delivery_destinations"("company_id", "destination_code");

-- CreateIndex
CREATE INDEX "materials_company_id_material_type_idx" ON "materials"("company_id", "material_type");

-- CreateIndex
CREATE INDEX "materials_company_id_status_idx" ON "materials"("company_id", "status");

-- CreateIndex
CREATE INDEX "materials_primary_supplier_id_idx" ON "materials"("primary_supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "materials_company_id_material_code_key" ON "materials"("company_id", "material_code");

-- CreateIndex
CREATE UNIQUE INDEX "material_categories_company_id_category_code_key" ON "material_categories"("company_id", "category_code");

-- CreateIndex
CREATE INDEX "product_categories_company_id_parent_category_id_idx" ON "product_categories"("company_id", "parent_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_company_id_category_code_key" ON "product_categories"("company_id", "category_code");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_company_id_expense_code_key" ON "expense_categories"("company_id", "expense_code");

-- CreateIndex
CREATE INDEX "exchange_rates_rate_date_idx" ON "exchange_rates"("rate_date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_target_currency_rate_date_sour_key" ON "exchange_rates"("base_currency", "target_currency", "rate_date", "source");

-- CreateIndex
CREATE UNIQUE INDEX "hs_codes_hs_code_key" ON "hs_codes"("hs_code");

-- CreateIndex
CREATE INDEX "hs_codes_chapter_idx" ON "hs_codes"("chapter");

-- CreateIndex
CREATE UNIQUE INDEX "fta_rules_fta_code_key" ON "fta_rules"("fta_code");

-- CreateIndex
CREATE INDEX "fta_rules_exporting_country_importing_country_idx" ON "fta_rules"("exporting_country", "importing_country");

-- CreateIndex
CREATE INDEX "fta_rules_hs_code_idx" ON "fta_rules"("hs_code");

-- CreateIndex
CREATE UNIQUE INDEX "business_terms_glossary_term_code_key" ON "business_terms_glossary"("term_code");

-- CreateIndex
CREATE INDEX "business_terms_glossary_category_idx" ON "business_terms_glossary"("category");

-- CreateIndex
CREATE INDEX "inquiries_company_id_status_idx" ON "inquiries"("company_id", "status");

-- CreateIndex
CREATE INDEX "inquiries_company_id_lead_source_idx" ON "inquiries"("company_id", "lead_source");

-- CreateIndex
CREATE INDEX "inquiries_company_id_existing_client_id_idx" ON "inquiries"("company_id", "existing_client_id");

-- CreateIndex
CREATE INDEX "inquiries_company_id_country_idx" ON "inquiries"("company_id", "country");

-- CreateIndex
CREATE INDEX "inquiries_received_at_idx" ON "inquiries"("received_at");

-- CreateIndex
CREATE INDEX "inquiries_assigned_to_user_id_idx" ON "inquiries"("assigned_to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_company_id_inquiry_number_key" ON "inquiries"("company_id", "inquiry_number");

-- CreateIndex
CREATE INDEX "inquiry_follow_ups_inquiry_id_follow_up_date_idx" ON "inquiry_follow_ups"("inquiry_id", "follow_up_date");

-- CreateIndex
CREATE INDEX "model_codes_company_id_brand_id_idx" ON "model_codes"("company_id", "brand_id");

-- CreateIndex
CREATE INDEX "model_codes_company_id_status_idx" ON "model_codes"("company_id", "status");

-- CreateIndex
CREATE INDEX "model_codes_company_id_category_id_idx" ON "model_codes"("company_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "model_codes_company_id_model_code_key" ON "model_codes"("company_id", "model_code");

-- CreateIndex
CREATE INDEX "products_company_id_status_idx" ON "products"("company_id", "status");

-- CreateIndex
CREATE INDEX "products_company_id_season_idx" ON "products"("company_id", "season");

-- CreateIndex
CREATE INDEX "products_company_id_client_id_idx" ON "products"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "products_company_id_brand_id_idx" ON "products"("company_id", "brand_id");

-- CreateIndex
CREATE INDEX "products_company_id_model_code_id_idx" ON "products"("company_id", "model_code_id");

-- CreateIndex
CREATE INDEX "products_company_id_inquiry_id_idx" ON "products"("company_id", "inquiry_id");

-- CreateIndex
CREATE INDEX "products_company_id_assigned_to_user_id_idx" ON "products"("company_id", "assigned_to_user_id");

-- CreateIndex
CREATE INDEX "products_company_id_is_overseas_production_idx" ON "products"("company_id", "is_overseas_production");

-- CreateIndex
CREATE UNIQUE INDEX "products_company_id_product_code_key" ON "products"("company_id", "product_code");

-- CreateIndex
CREATE INDEX "product_status_history_product_id_changed_at_idx" ON "product_status_history"("product_id", "changed_at");

-- CreateIndex
CREATE INDEX "skus_product_id_idx" ON "skus"("product_id");

-- CreateIndex
CREATE INDEX "skus_company_id_jan_code_idx" ON "skus"("company_id", "jan_code");

-- CreateIndex
CREATE INDEX "skus_company_id_color_code_idx" ON "skus"("company_id", "color_code");

-- CreateIndex
CREATE UNIQUE INDEX "skus_company_id_sku_code_key" ON "skus"("company_id", "sku_code");

-- CreateIndex
CREATE INDEX "collections_company_id_status_idx" ON "collections"("company_id", "status");

-- CreateIndex
CREATE INDEX "collections_company_id_client_id_idx" ON "collections"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "collections_company_id_season_idx" ON "collections"("company_id", "season");

-- CreateIndex
CREATE UNIQUE INDEX "collections_company_id_collection_code_key" ON "collections"("company_id", "collection_code");

-- CreateIndex
CREATE INDEX "collection_products_product_id_idx" ON "collection_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_products_collection_id_product_id_key" ON "collection_products"("collection_id", "product_id");

-- CreateIndex
CREATE INDEX "product_repetition_lineage_model_code_id_idx" ON "product_repetition_lineage"("model_code_id");

-- CreateIndex
CREATE INDEX "product_repetition_lineage_parent_product_id_idx" ON "product_repetition_lineage"("parent_product_id");

-- CreateIndex
CREATE INDEX "product_repetition_lineage_child_product_id_idx" ON "product_repetition_lineage"("child_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_repetition_lineage_parent_product_id_child_product__key" ON "product_repetition_lineage"("parent_product_id", "child_product_id");

-- CreateIndex
CREATE INDEX "specifications_company_id_product_id_idx" ON "specifications"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "specifications_company_id_status_idx" ON "specifications"("company_id", "status");

-- CreateIndex
CREATE INDEX "specifications_product_id_version_number_idx" ON "specifications"("product_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "specifications_product_id_version_key" ON "specifications"("product_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "specifications_multilingual_specification_id_language_key" ON "specifications_multilingual"("specification_id", "language");

-- CreateIndex
CREATE INDEX "pattern_versions_company_id_model_code_id_idx" ON "pattern_versions"("company_id", "model_code_id");

-- CreateIndex
CREATE INDEX "pattern_versions_company_id_status_idx" ON "pattern_versions"("company_id", "status");

-- CreateIndex
CREATE INDEX "pattern_versions_base_version_id_idx" ON "pattern_versions"("base_version_id");

-- CreateIndex
CREATE INDEX "pattern_versions_contractor_id_idx" ON "pattern_versions"("contractor_id");

-- CreateIndex
CREATE UNIQUE INDEX "pattern_versions_model_code_id_version_key" ON "pattern_versions"("model_code_id", "version");

-- CreateIndex
CREATE INDEX "design_versions_company_id_model_code_id_idx" ON "design_versions"("company_id", "model_code_id");

-- CreateIndex
CREATE INDEX "design_versions_company_id_product_id_idx" ON "design_versions"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "design_versions_company_id_status_idx" ON "design_versions"("company_id", "status");

-- CreateIndex
CREATE INDEX "design_versions_designer_id_idx" ON "design_versions"("designer_id");

-- CreateIndex
CREATE UNIQUE INDEX "design_versions_model_code_id_version_key" ON "design_versions"("model_code_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "bom_specification_id_key" ON "bom"("specification_id");

-- CreateIndex
CREATE INDEX "bom_company_id_idx" ON "bom"("company_id");

-- CreateIndex
CREATE INDEX "bom_items_bom_id_item_order_idx" ON "bom_items"("bom_id", "item_order");

-- CreateIndex
CREATE INDEX "bom_items_material_id_idx" ON "bom_items"("material_id");

-- CreateIndex
CREATE INDEX "bom_items_supplier_id_idx" ON "bom_items"("supplier_id");

-- CreateIndex
CREATE INDEX "moodboards_company_id_idx" ON "moodboards"("company_id");

-- CreateIndex
CREATE INDEX "moodboards_brand_id_idx" ON "moodboards"("brand_id");

-- CreateIndex
CREATE INDEX "moodboards_model_code_id_idx" ON "moodboards"("model_code_id");

-- CreateIndex
CREATE INDEX "moodboards_inquiry_id_idx" ON "moodboards"("inquiry_id");

-- CreateIndex
CREATE INDEX "moodboards_product_id_idx" ON "moodboards"("product_id");

-- CreateIndex
CREATE INDEX "moodboards_collection_id_idx" ON "moodboards"("collection_id");

-- CreateIndex
CREATE INDEX "moodboard_items_moodboard_id_idx" ON "moodboard_items"("moodboard_id");

-- CreateIndex
CREATE INDEX "asset_library_company_id_category_idx" ON "asset_library"("company_id", "category");

-- CreateIndex
CREATE INDEX "asset_library_brand_id_idx" ON "asset_library"("brand_id");

-- CreateIndex
CREATE INDEX "asset_library_model_code_id_idx" ON "asset_library"("model_code_id");

-- CreateIndex
CREATE INDEX "asset_library_product_category_id_idx" ON "asset_library"("product_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_tags_company_id_tag_name_key" ON "asset_tags"("company_id", "tag_name");

-- CreateIndex
CREATE INDEX "asset_tag_links_tag_id_idx" ON "asset_tag_links"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_tag_links_asset_id_tag_id_key" ON "asset_tag_links"("asset_id", "tag_id");

-- CreateIndex
CREATE INDEX "photography_projects_company_id_status_idx" ON "photography_projects"("company_id", "status");

-- CreateIndex
CREATE INDEX "photography_projects_company_id_shoot_date_idx" ON "photography_projects"("company_id", "shoot_date");

-- CreateIndex
CREATE INDEX "photography_projects_client_id_idx" ON "photography_projects"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "photography_projects_company_id_project_code_key" ON "photography_projects"("company_id", "project_code");

-- CreateIndex
CREATE INDEX "photography_items_project_id_idx" ON "photography_items"("project_id");

-- CreateIndex
CREATE INDEX "photography_items_product_id_idx" ON "photography_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "photography_items_project_id_product_id_color_code_key" ON "photography_items"("project_id", "product_id", "color_code");

-- CreateIndex
CREATE INDEX "shared_files_company_id_idx" ON "shared_files"("company_id");

-- CreateIndex
CREATE INDEX "shared_files_attached_to_type_attached_to_id_idx" ON "shared_files"("attached_to_type", "attached_to_id");

-- CreateIndex
CREATE INDEX "shared_files_uploaded_by_user_id_idx" ON "shared_files"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "quotations_company_id_product_id_idx" ON "quotations"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "quotations_company_id_client_id_idx" ON "quotations"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "quotations_company_id_status_idx" ON "quotations"("company_id", "status");

-- CreateIndex
CREATE INDEX "quotations_company_id_quotation_type_idx" ON "quotations"("company_id", "quotation_type");

-- CreateIndex
CREATE INDEX "quotations_valid_until_is_expired_idx" ON "quotations"("valid_until", "is_expired");

-- CreateIndex
CREATE INDEX "quotations_is_latest_product_id_idx" ON "quotations"("is_latest", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_company_id_quotation_number_key" ON "quotations"("company_id", "quotation_number");

-- CreateIndex
CREATE INDEX "quotation_moq_tiers_quotation_id_idx" ON "quotation_moq_tiers"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_moq_tiers_quotation_id_tier_order_key" ON "quotation_moq_tiers"("quotation_id", "tier_order");

-- CreateIndex
CREATE INDEX "quotation_cost_breakdowns_quotation_id_item_order_idx" ON "quotation_cost_breakdowns"("quotation_id", "item_order");

-- CreateIndex
CREATE INDEX "quotation_cost_breakdowns_quotation_id_external_category_idx" ON "quotation_cost_breakdowns"("quotation_id", "external_category");

-- CreateIndex
CREATE INDEX "quotation_cost_breakdowns_quotation_id_internal_category_idx" ON "quotation_cost_breakdowns"("quotation_id", "internal_category");

-- CreateIndex
CREATE INDEX "margin_settings_company_id_level_idx" ON "margin_settings"("company_id", "level");

-- CreateIndex
CREATE INDEX "margin_settings_brand_id_idx" ON "margin_settings"("brand_id");

-- CreateIndex
CREATE INDEX "margin_settings_product_id_idx" ON "margin_settings"("product_id");

-- CreateIndex
CREATE INDEX "quotation_approval_history_quotation_id_performed_at_idx" ON "quotation_approval_history"("quotation_id", "performed_at");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_multilingual_quotation_id_language_key" ON "quotation_multilingual"("quotation_id", "language");

-- CreateIndex
CREATE INDEX "quotation_pdf_outputs_quotation_id_created_at_idx" ON "quotation_pdf_outputs"("quotation_id", "created_at");

-- CreateIndex
CREATE INDEX "quotation_conversions_quotation_id_idx" ON "quotation_conversions"("quotation_id");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_supplier_id_idx" ON "purchase_orders"("company_id", "supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_status_idx" ON "purchase_orders"("company_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_primary_product_id_idx" ON "purchase_orders"("company_id", "primary_product_id");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_allocation_type_idx" ON "purchase_orders"("company_id", "allocation_type");

-- CreateIndex
CREATE INDEX "purchase_orders_company_id_order_date_idx" ON "purchase_orders"("company_id", "order_date");

-- CreateIndex
CREATE INDEX "purchase_orders_expected_delivery_date_idx" ON "purchase_orders"("expected_delivery_date");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_company_id_po_number_key" ON "purchase_orders"("company_id", "po_number");

-- CreateIndex
CREATE INDEX "po_items_po_id_item_order_idx" ON "po_items"("po_id", "item_order");

-- CreateIndex
CREATE INDEX "po_items_material_id_idx" ON "po_items"("material_id");

-- CreateIndex
CREATE INDEX "po_allocations_po_id_idx" ON "po_allocations"("po_id");

-- CreateIndex
CREATE INDEX "po_allocations_product_id_idx" ON "po_allocations"("product_id");

-- CreateIndex
CREATE INDEX "po_allocations_po_item_id_idx" ON "po_allocations"("po_item_id");

-- CreateIndex
CREATE INDEX "work_orders_company_id_factory_id_idx" ON "work_orders"("company_id", "factory_id");

-- CreateIndex
CREATE INDEX "work_orders_company_id_contractor_id_idx" ON "work_orders"("company_id", "contractor_id");

-- CreateIndex
CREATE INDEX "work_orders_company_id_product_id_idx" ON "work_orders"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "work_orders_company_id_model_code_id_idx" ON "work_orders"("company_id", "model_code_id");

-- CreateIndex
CREATE INDEX "work_orders_company_id_status_idx" ON "work_orders"("company_id", "status");

-- CreateIndex
CREATE INDEX "work_orders_company_id_work_type_idx" ON "work_orders"("company_id", "work_type");

-- CreateIndex
CREATE INDEX "work_orders_company_id_work_category_idx" ON "work_orders"("company_id", "work_category");

-- CreateIndex
CREATE INDEX "work_orders_company_id_sample_production_id_idx" ON "work_orders"("company_id", "sample_production_id");

-- CreateIndex
CREATE INDEX "work_orders_expected_delivery_date_idx" ON "work_orders"("expected_delivery_date");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_company_id_wo_number_key" ON "work_orders"("company_id", "wo_number");

-- CreateIndex
CREATE INDEX "wo_items_wo_id_item_order_idx" ON "wo_items"("wo_id", "item_order");

-- CreateIndex
CREATE INDEX "wo_items_sku_id_idx" ON "wo_items"("sku_id");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_product_id_idx" ON "sales_orders"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_client_id_idx" ON "sales_orders"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_buyer_id_idx" ON "sales_orders"("company_id", "buyer_id");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_status_idx" ON "sales_orders"("company_id", "status");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_source_type_idx" ON "sales_orders"("company_id", "source_type");

-- CreateIndex
CREATE INDEX "sales_orders_company_id_order_date_idx" ON "sales_orders"("company_id", "order_date");

-- CreateIndex
CREATE INDEX "sales_orders_quotation_id_idx" ON "sales_orders"("quotation_id");

-- CreateIndex
CREATE INDEX "sales_orders_is_latest_product_id_idx" ON "sales_orders"("is_latest", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_company_id_so_number_key" ON "sales_orders"("company_id", "so_number");

-- CreateIndex
CREATE INDEX "so_items_sku_id_idx" ON "so_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "so_items_so_id_sku_id_key" ON "so_items"("so_id", "sku_id");

-- CreateIndex
CREATE INDEX "sales_order_change_history_so_id_changed_at_idx" ON "sales_order_change_history"("so_id", "changed_at");

-- CreateIndex
CREATE INDEX "order_pages_company_id_product_id_idx" ON "order_pages"("company_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_pages_company_id_page_slug_key" ON "order_pages"("company_id", "page_slug");

-- CreateIndex
CREATE INDEX "sample_productions_company_id_product_id_idx" ON "sample_productions"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "sample_productions_company_id_status_idx" ON "sample_productions"("company_id", "status");

-- CreateIndex
CREATE INDEX "sample_productions_product_id_round_order_idx" ON "sample_productions"("product_id", "round_order");

-- CreateIndex
CREATE INDEX "sample_productions_parent_sample_id_idx" ON "sample_productions"("parent_sample_id");

-- CreateIndex
CREATE UNIQUE INDEX "sample_productions_company_id_sample_number_key" ON "sample_productions"("company_id", "sample_number");

-- CreateIndex
CREATE INDEX "sample_revisions_sample_production_id_revision_order_idx" ON "sample_revisions"("sample_production_id", "revision_order");

-- CreateIndex
CREATE INDEX "order_status_checks_company_id_check_month_idx" ON "order_status_checks"("company_id", "check_month");

-- CreateIndex
CREATE INDEX "order_status_checks_company_id_status_idx" ON "order_status_checks"("company_id", "status");

-- CreateIndex
CREATE INDEX "order_status_checks_supplier_id_idx" ON "order_status_checks"("supplier_id");

-- CreateIndex
CREATE INDEX "order_status_checks_factory_id_idx" ON "order_status_checks"("factory_id");

-- CreateIndex
CREATE INDEX "storage_locations_company_id_location_type_idx" ON "storage_locations"("company_id", "location_type");

-- CreateIndex
CREATE INDEX "storage_locations_company_id_status_idx" ON "storage_locations"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_company_id_location_code_key" ON "storage_locations"("company_id", "location_code");

-- CreateIndex
CREATE INDEX "inventory_lots_company_id_material_id_idx" ON "inventory_lots"("company_id", "material_id");

-- CreateIndex
CREATE INDEX "inventory_lots_company_id_supplier_id_idx" ON "inventory_lots"("company_id", "supplier_id");

-- CreateIndex
CREATE INDEX "inventory_lots_company_id_storage_location_id_idx" ON "inventory_lots"("company_id", "storage_location_id");

-- CreateIndex
CREATE INDEX "inventory_lots_company_id_status_idx" ON "inventory_lots"("company_id", "status");

-- CreateIndex
CREATE INDEX "inventory_lots_company_id_inventory_type_idx" ON "inventory_lots"("company_id", "inventory_type");

-- CreateIndex
CREATE INDEX "inventory_lots_po_id_idx" ON "inventory_lots"("po_id");

-- CreateIndex
CREATE INDEX "inventory_lots_expiry_date_idx" ON "inventory_lots"("expiry_date");

-- CreateIndex
CREATE INDEX "inventory_lots_received_date_idx" ON "inventory_lots"("received_date");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lots_company_id_lot_number_key" ON "inventory_lots"("company_id", "lot_number");

-- CreateIndex
CREATE INDEX "inventory_movements_company_id_performed_at_idx" ON "inventory_movements"("company_id", "performed_at");

-- CreateIndex
CREATE INDEX "inventory_movements_inventory_lot_id_performed_at_idx" ON "inventory_movements"("inventory_lot_id", "performed_at");

-- CreateIndex
CREATE INDEX "inventory_movements_product_id_idx" ON "inventory_movements"("product_id");

-- CreateIndex
CREATE INDEX "inventory_movements_sku_id_idx" ON "inventory_movements"("sku_id");

-- CreateIndex
CREATE INDEX "inventory_movements_movement_type_idx" ON "inventory_movements"("movement_type");

-- CreateIndex
CREATE INDEX "inventory_valuations_company_id_valuation_date_idx" ON "inventory_valuations"("company_id", "valuation_date");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_valuations_company_id_valuation_date_period_type_key" ON "inventory_valuations"("company_id", "valuation_date", "period_type");

-- CreateIndex
CREATE INDEX "inventory_alerts_company_id_alert_type_status_idx" ON "inventory_alerts"("company_id", "alert_type", "status");

-- CreateIndex
CREATE INDEX "inventory_alerts_company_id_severity_status_idx" ON "inventory_alerts"("company_id", "severity", "status");

-- CreateIndex
CREATE INDEX "inventory_alerts_inventory_lot_id_idx" ON "inventory_alerts"("inventory_lot_id");

-- CreateIndex
CREATE INDEX "inventory_alerts_triggered_at_idx" ON "inventory_alerts"("triggered_at");

-- CreateIndex
CREATE INDEX "finished_goods_inventory_company_id_product_id_idx" ON "finished_goods_inventory"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "finished_goods_inventory_company_id_sku_id_idx" ON "finished_goods_inventory"("company_id", "sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "finished_goods_inventory_sku_id_storage_location_id_key" ON "finished_goods_inventory"("sku_id", "storage_location_id");

-- CreateIndex
CREATE INDEX "finished_goods_movements_company_id_performed_at_idx" ON "finished_goods_movements"("company_id", "performed_at");

-- CreateIndex
CREATE INDEX "finished_goods_movements_finished_goods_id_performed_at_idx" ON "finished_goods_movements"("finished_goods_id", "performed_at");

-- CreateIndex
CREATE INDEX "finished_goods_movements_wo_id_idx" ON "finished_goods_movements"("wo_id");

-- CreateIndex
CREATE INDEX "finished_goods_movements_so_id_idx" ON "finished_goods_movements"("so_id");

-- CreateIndex
CREATE INDEX "factory_consigned_inventory_company_id_factory_id_idx" ON "factory_consigned_inventory"("company_id", "factory_id");

-- CreateIndex
CREATE INDEX "factory_consigned_inventory_company_id_status_idx" ON "factory_consigned_inventory"("company_id", "status");

-- CreateIndex
CREATE INDEX "factory_consigned_inventory_inventory_lot_id_idx" ON "factory_consigned_inventory"("inventory_lot_id");

-- CreateIndex
CREATE INDEX "factory_consigned_inventory_product_id_idx" ON "factory_consigned_inventory"("product_id");

-- CreateIndex
CREATE INDEX "factory_consumption_records_factory_consigned_id_consumed_d_idx" ON "factory_consumption_records"("factory_consigned_id", "consumed_date");

-- CreateIndex
CREATE INDEX "factory_consumption_records_product_id_idx" ON "factory_consumption_records"("product_id");

-- CreateIndex
CREATE INDEX "stocktakings_company_id_status_idx" ON "stocktakings"("company_id", "status");

-- CreateIndex
CREATE INDEX "stocktakings_scheduled_date_idx" ON "stocktakings"("scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "stocktakings_company_id_stocktaking_number_key" ON "stocktakings"("company_id", "stocktaking_number");

-- CreateIndex
CREATE INDEX "stocktaking_items_stocktaking_id_idx" ON "stocktaking_items"("stocktaking_id");

-- CreateIndex
CREATE INDEX "stocktaking_items_inventory_lot_id_idx" ON "stocktaking_items"("inventory_lot_id");

-- CreateIndex
CREATE UNIQUE INDEX "stocktaking_items_stocktaking_id_inventory_lot_id_key" ON "stocktaking_items"("stocktaking_id", "inventory_lot_id");

-- CreateIndex
CREATE INDEX "surplus_dispositions_company_id_product_id_idx" ON "surplus_dispositions"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "surplus_dispositions_company_id_status_idx" ON "surplus_dispositions"("company_id", "status");

-- CreateIndex
CREATE INDEX "surplus_dispositions_inventory_lot_id_idx" ON "surplus_dispositions"("inventory_lot_id");

-- CreateIndex
CREATE INDEX "surplus_dispositions_client_id_idx" ON "surplus_dispositions"("client_id");

-- CreateIndex
CREATE INDEX "delivery_notes_company_id_product_id_idx" ON "delivery_notes"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "delivery_notes_company_id_client_id_idx" ON "delivery_notes"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "delivery_notes_company_id_buyer_id_idx" ON "delivery_notes"("company_id", "buyer_id");

-- CreateIndex
CREATE INDEX "delivery_notes_company_id_status_idx" ON "delivery_notes"("company_id", "status");

-- CreateIndex
CREATE INDEX "delivery_notes_company_id_delivery_date_idx" ON "delivery_notes"("company_id", "delivery_date");

-- CreateIndex
CREATE INDEX "delivery_notes_primary_so_id_idx" ON "delivery_notes"("primary_so_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_company_id_delivery_number_key" ON "delivery_notes"("company_id", "delivery_number");

-- CreateIndex
CREATE INDEX "delivery_note_items_delivery_note_id_item_order_idx" ON "delivery_note_items"("delivery_note_id", "item_order");

-- CreateIndex
CREATE INDEX "delivery_note_items_sku_id_idx" ON "delivery_note_items"("sku_id");

-- CreateIndex
CREATE INDEX "delivery_note_items_product_id_idx" ON "delivery_note_items"("product_id");

-- CreateIndex
CREATE INDEX "delivery_note_items_so_id_idx" ON "delivery_note_items"("so_id");

-- CreateIndex
CREATE INDEX "shipments_company_id_status_idx" ON "shipments"("company_id", "status");

-- CreateIndex
CREATE INDEX "shipments_tracking_number_idx" ON "shipments"("tracking_number");

-- CreateIndex
CREATE INDEX "shipments_delivery_note_id_idx" ON "shipments"("delivery_note_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_company_id_shipment_number_key" ON "shipments"("company_id", "shipment_number");

-- CreateIndex
CREATE INDEX "invoices_company_id_client_id_idx" ON "invoices"("company_id", "client_id");

-- CreateIndex
CREATE INDEX "invoices_company_id_status_idx" ON "invoices"("company_id", "status");

-- CreateIndex
CREATE INDEX "invoices_company_id_invoice_type_idx" ON "invoices"("company_id", "invoice_type");

-- CreateIndex
CREATE INDEX "invoices_company_id_payment_due_date_idx" ON "invoices"("company_id", "payment_due_date");

-- CreateIndex
CREATE INDEX "invoices_company_id_is_fully_paid_idx" ON "invoices"("company_id", "is_fully_paid");

-- CreateIndex
CREATE INDEX "invoices_primary_so_id_idx" ON "invoices"("primary_so_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_company_id_invoice_number_key" ON "invoices"("company_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_item_order_idx" ON "invoice_items"("invoice_id", "item_order");

-- CreateIndex
CREATE INDEX "invoice_items_product_id_idx" ON "invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "invoice_items_sku_id_idx" ON "invoice_items"("sku_id");

-- CreateIndex
CREATE INDEX "payments_company_id_payment_direction_idx" ON "payments"("company_id", "payment_direction");

-- CreateIndex
CREATE INDEX "payments_company_id_status_idx" ON "payments"("company_id", "status");

-- CreateIndex
CREATE INDEX "payments_company_id_counterpart_type_counterpart_id_idx" ON "payments"("company_id", "counterpart_type", "counterpart_id");

-- CreateIndex
CREATE INDEX "payments_company_id_scheduled_date_idx" ON "payments"("company_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "payments_company_id_actual_payment_date_idx" ON "payments"("company_id", "actual_payment_date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_company_id_payment_number_key" ON "payments"("company_id", "payment_number");

-- CreateIndex
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_payments_payment_id_idx" ON "invoice_payments"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payments_invoice_id_payment_id_key" ON "invoice_payments"("invoice_id", "payment_id");

-- CreateIndex
CREATE INDEX "international_remittances_company_id_status_idx" ON "international_remittances"("company_id", "status");

-- CreateIndex
CREATE INDEX "international_remittances_company_id_direction_idx" ON "international_remittances"("company_id", "direction");

-- CreateIndex
CREATE INDEX "international_remittances_company_id_initiated_at_idx" ON "international_remittances"("company_id", "initiated_at");

-- CreateIndex
CREATE INDEX "international_remittances_payment_id_idx" ON "international_remittances"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "international_remittances_company_id_remittance_number_key" ON "international_remittances"("company_id", "remittance_number");

-- CreateIndex
CREATE INDEX "fx_records_company_id_record_type_idx" ON "fx_records"("company_id", "record_type");

-- CreateIndex
CREATE INDEX "fx_records_company_id_transaction_date_idx" ON "fx_records"("company_id", "transaction_date");

-- CreateIndex
CREATE INDEX "fx_records_invoice_id_idx" ON "fx_records"("invoice_id");

-- CreateIndex
CREATE INDEX "fx_records_payment_id_idx" ON "fx_records"("payment_id");

-- CreateIndex
CREATE INDEX "fx_records_remittance_id_idx" ON "fx_records"("remittance_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_classifications_classification_code_key" ON "tax_classifications"("classification_code");

-- CreateIndex
CREATE INDEX "tax_classifications_classification_idx" ON "tax_classifications"("classification");

-- CreateIndex
CREATE INDEX "tax_classifications_effective_from_effective_until_idx" ON "tax_classifications"("effective_from", "effective_until");

-- CreateIndex
CREATE INDEX "tax_calculation_logs_company_id_period_year_period_month_idx" ON "tax_calculation_logs"("company_id", "period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "tax_calculation_logs_company_id_period_year_period_month_ca_key" ON "tax_calculation_logs"("company_id", "period_year", "period_month", "calculation_type");

-- CreateIndex
CREATE INDEX "transition_measure_records_company_id_transaction_date_idx" ON "transition_measure_records"("company_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transition_measure_records_supplier_id_idx" ON "transition_measure_records"("supplier_id");

-- CreateIndex
CREATE INDEX "transition_measure_records_invoice_id_idx" ON "transition_measure_records"("invoice_id");

-- CreateIndex
CREATE INDEX "trade_transactions_company_id_status_idx" ON "trade_transactions"("company_id", "status");

-- CreateIndex
CREATE INDEX "trade_transactions_company_id_trade_type_idx" ON "trade_transactions"("company_id", "trade_type");

-- CreateIndex
CREATE INDEX "trade_transactions_company_id_product_id_idx" ON "trade_transactions"("company_id", "product_id");

-- CreateIndex
CREATE INDEX "trade_transactions_company_id_shipment_date_idx" ON "trade_transactions"("company_id", "shipment_date");

-- CreateIndex
CREATE INDEX "trade_transactions_origin_country_import_country_idx" ON "trade_transactions"("origin_country", "import_country");

-- CreateIndex
CREATE UNIQUE INDEX "trade_transactions_company_id_trade_number_key" ON "trade_transactions"("company_id", "trade_number");

-- CreateIndex
CREATE INDEX "commercial_invoices_trade_transaction_id_idx" ON "commercial_invoices"("trade_transaction_id");

-- CreateIndex
CREATE INDEX "commercial_invoices_company_id_status_idx" ON "commercial_invoices"("company_id", "status");

-- CreateIndex
CREATE INDEX "commercial_invoices_issue_date_idx" ON "commercial_invoices"("issue_date");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_invoices_company_id_ci_number_key" ON "commercial_invoices"("company_id", "ci_number");

-- CreateIndex
CREATE INDEX "commercial_invoice_items_commercial_invoice_id_item_order_idx" ON "commercial_invoice_items"("commercial_invoice_id", "item_order");

-- CreateIndex
CREATE INDEX "commercial_invoice_items_product_id_idx" ON "commercial_invoice_items"("product_id");

-- CreateIndex
CREATE INDEX "commercial_invoice_items_hs_code_idx" ON "commercial_invoice_items"("hs_code");

-- CreateIndex
CREATE INDEX "packing_lists_trade_transaction_id_idx" ON "packing_lists"("trade_transaction_id");

-- CreateIndex
CREATE INDEX "packing_lists_commercial_invoice_id_idx" ON "packing_lists"("commercial_invoice_id");

-- CreateIndex
CREATE INDEX "packing_lists_company_id_status_idx" ON "packing_lists"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "packing_lists_company_id_pl_number_key" ON "packing_lists"("company_id", "pl_number");

-- CreateIndex
CREATE INDEX "packing_list_items_packing_list_id_idx" ON "packing_list_items"("packing_list_id");

-- CreateIndex
CREATE INDEX "packing_list_items_product_id_idx" ON "packing_list_items"("product_id");

-- CreateIndex
CREATE INDEX "certificates_of_origin_trade_transaction_id_idx" ON "certificates_of_origin"("trade_transaction_id");

-- CreateIndex
CREATE INDEX "certificates_of_origin_company_id_form_type_idx" ON "certificates_of_origin"("company_id", "form_type");

-- CreateIndex
CREATE INDEX "certificates_of_origin_company_id_status_idx" ON "certificates_of_origin"("company_id", "status");

-- CreateIndex
CREATE INDEX "certificates_of_origin_issue_date_idx" ON "certificates_of_origin"("issue_date");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_of_origin_company_id_co_number_key" ON "certificates_of_origin"("company_id", "co_number");

-- CreateIndex
CREATE INDEX "fta_applications_trade_transaction_id_idx" ON "fta_applications"("trade_transaction_id");

-- CreateIndex
CREATE INDEX "fta_applications_company_id_fta_code_idx" ON "fta_applications"("company_id", "fta_code");

-- CreateIndex
CREATE INDEX "fta_applications_application_date_idx" ON "fta_applications"("application_date");

-- CreateIndex
CREATE INDEX "bills_of_lading_trade_transaction_id_idx" ON "bills_of_lading"("trade_transaction_id");

-- CreateIndex
CREATE INDEX "bills_of_lading_company_id_status_idx" ON "bills_of_lading"("company_id", "status");

-- CreateIndex
CREATE INDEX "bills_of_lading_shipment_date_idx" ON "bills_of_lading"("shipment_date");

-- CreateIndex
CREATE UNIQUE INDEX "bills_of_lading_company_id_bl_number_key" ON "bills_of_lading"("company_id", "bl_number");

-- CreateIndex
CREATE INDEX "air_waybills_trade_transaction_id_idx" ON "air_waybills"("trade_transaction_id");

-- CreateIndex
CREATE INDEX "air_waybills_company_id_status_idx" ON "air_waybills"("company_id", "status");

-- CreateIndex
CREATE INDEX "air_waybills_shipment_date_idx" ON "air_waybills"("shipment_date");

-- CreateIndex
CREATE UNIQUE INDEX "air_waybills_company_id_awb_number_key" ON "air_waybills"("company_id", "awb_number");

-- CreateIndex
CREATE INDEX "customs_declarations_trade_transaction_id_idx" ON "customs_declarations"("trade_transaction_id");

-- CreateIndex
CREATE INDEX "customs_declarations_company_id_status_idx" ON "customs_declarations"("company_id", "status");

-- CreateIndex
CREATE INDEX "customs_declarations_declaration_date_idx" ON "customs_declarations"("declaration_date");

-- CreateIndex
CREATE UNIQUE INDEX "customs_declarations_company_id_declaration_number_key" ON "customs_declarations"("company_id", "declaration_number");

-- CreateIndex
CREATE INDEX "trade_document_files_trade_transaction_id_idx" ON "trade_document_files"("trade_transaction_id");

-- CreateIndex
CREATE INDEX "trade_document_files_company_id_document_type_idx" ON "trade_document_files"("company_id", "document_type");

-- CreateIndex
CREATE INDEX "trade_document_files_related_document_id_idx" ON "trade_document_files"("related_document_id");

-- CreateIndex
CREATE INDEX "import_export_compliance_logs_company_id_trade_transaction__idx" ON "import_export_compliance_logs"("company_id", "trade_transaction_id");

-- CreateIndex
CREATE INDEX "import_export_compliance_logs_company_id_status_idx" ON "import_export_compliance_logs"("company_id", "status");

-- CreateIndex
CREATE INDEX "import_export_compliance_logs_performed_at_idx" ON "import_export_compliance_logs"("performed_at");

-- CreateIndex
CREATE INDEX "comments_company_id_attached_to_type_attached_to_id_idx" ON "comments"("company_id", "attached_to_type", "attached_to_id");

-- CreateIndex
CREATE INDEX "comments_company_id_author_user_id_idx" ON "comments"("company_id", "author_user_id");

-- CreateIndex
CREATE INDEX "comments_parent_comment_id_idx" ON "comments"("parent_comment_id");

-- CreateIndex
CREATE INDEX "comments_thread_root_id_idx" ON "comments"("thread_root_id");

-- CreateIndex
CREATE INDEX "comments_created_at_idx" ON "comments"("created_at");

-- CreateIndex
CREATE INDEX "comment_mentions_mentioned_user_id_is_read_idx" ON "comment_mentions"("mentioned_user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "comment_mentions_comment_id_mentioned_user_id_key" ON "comment_mentions"("comment_id", "mentioned_user_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_is_read_idx" ON "notifications"("recipient_user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_company_id_notification_type_idx" ON "notifications"("company_id", "notification_type");

-- CreateIndex
CREATE INDEX "notifications_company_id_category_idx" ON "notifications"("company_id", "category");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_priority_idx" ON "notifications"("priority");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_notification_type_key" ON "notification_preferences"("user_id", "notification_type");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_message_id_key" ON "email_messages"("message_id");

-- CreateIndex
CREATE INDEX "email_messages_company_id_status_idx" ON "email_messages"("company_id", "status");

-- CreateIndex
CREATE INDEX "email_messages_company_id_direction_idx" ON "email_messages"("company_id", "direction");

-- CreateIndex
CREATE INDEX "email_messages_company_id_received_at_idx" ON "email_messages"("company_id", "received_at");

-- CreateIndex
CREATE INDEX "email_messages_thread_id_idx" ON "email_messages"("thread_id");

-- CreateIndex
CREATE INDEX "email_messages_from_email_idx" ON "email_messages"("from_email");

-- CreateIndex
CREATE INDEX "email_messages_ai_classification_idx" ON "email_messages"("ai_classification");

-- CreateIndex
CREATE INDEX "email_messages_assigned_to_user_id_idx" ON "email_messages"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "email_attachments_email_message_id_idx" ON "email_attachments"("email_message_id");

-- CreateIndex
CREATE INDEX "email_attachments_attached_to_type_attached_to_id_idx" ON "email_attachments"("attached_to_type", "attached_to_id");

-- CreateIndex
CREATE INDEX "email_classification_logs_email_message_id_processing_level_idx" ON "email_classification_logs"("email_message_id", "processing_level");

-- CreateIndex
CREATE INDEX "email_classification_logs_processed_at_idx" ON "email_classification_logs"("processed_at");

-- CreateIndex
CREATE INDEX "ai_processing_logs_company_id_processing_type_idx" ON "ai_processing_logs"("company_id", "processing_type");

-- CreateIndex
CREATE INDEX "ai_processing_logs_company_id_processed_at_idx" ON "ai_processing_logs"("company_id", "processed_at");

-- CreateIndex
CREATE INDEX "ai_processing_logs_company_id_model_name_idx" ON "ai_processing_logs"("company_id", "model_name");

-- CreateIndex
CREATE INDEX "ai_processing_logs_related_entity_type_related_entity_id_idx" ON "ai_processing_logs"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "ai_translation_records_source_language_target_language_idx" ON "ai_translation_records"("source_language", "target_language");

-- CreateIndex
CREATE INDEX "ai_translation_records_attached_to_type_attached_to_id_idx" ON "ai_translation_records"("attached_to_type", "attached_to_id");

-- CreateIndex
CREATE INDEX "ai_translation_records_source_text_hash_idx" ON "ai_translation_records"("source_text_hash");

-- CreateIndex
CREATE INDEX "meeting_transcripts_company_id_meeting_date_idx" ON "meeting_transcripts"("company_id", "meeting_date");

-- CreateIndex
CREATE INDEX "meeting_transcripts_company_id_status_idx" ON "meeting_transcripts"("company_id", "status");

-- CreateIndex
CREATE INDEX "meeting_transcripts_company_id_meeting_type_idx" ON "meeting_transcripts"("company_id", "meeting_type");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_transcripts_company_id_meeting_number_key" ON "meeting_transcripts"("company_id", "meeting_number");

-- CreateIndex
CREATE INDEX "document_templates_company_id_template_type_level_idx" ON "document_templates"("company_id", "template_type", "level");

-- CreateIndex
CREATE INDEX "document_templates_company_id_status_idx" ON "document_templates"("company_id", "status");

-- CreateIndex
CREATE INDEX "document_templates_client_id_idx" ON "document_templates"("client_id");

-- CreateIndex
CREATE INDEX "document_templates_supplier_id_idx" ON "document_templates"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_company_id_key" ON "company_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_configurations_config_key_key" ON "system_configurations"("config_key");

-- CreateIndex
CREATE INDEX "system_configurations_category_idx" ON "system_configurations"("category");

-- CreateIndex
CREATE INDEX "csv_import_jobs_company_id_status_idx" ON "csv_import_jobs"("company_id", "status");

-- CreateIndex
CREATE INDEX "csv_import_jobs_company_id_target_entity_idx" ON "csv_import_jobs"("company_id", "target_entity");

-- CreateIndex
CREATE UNIQUE INDEX "csv_import_jobs_company_id_job_number_key" ON "csv_import_jobs"("company_id", "job_number");

-- CreateIndex
CREATE INDEX "data_export_jobs_company_id_status_idx" ON "data_export_jobs"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "data_export_jobs_company_id_job_number_key" ON "data_export_jobs"("company_id", "job_number");

-- CreateIndex
CREATE INDEX "external_integrations_company_id_service_type_idx" ON "external_integrations"("company_id", "service_type");

-- CreateIndex
CREATE INDEX "external_integrations_company_id_is_active_idx" ON "external_integrations"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "external_integrations_company_id_service_name_key" ON "external_integrations"("company_id", "service_name");

-- CreateIndex
CREATE INDEX "webhook_logs_company_id_source_idx" ON "webhook_logs"("company_id", "source");

-- CreateIndex
CREATE INDEX "webhook_logs_company_id_event_type_idx" ON "webhook_logs"("company_id", "event_type");

-- CreateIndex
CREATE INDEX "webhook_logs_received_at_idx" ON "webhook_logs"("received_at");

-- CreateIndex
CREATE INDEX "webhook_logs_is_processed_idx" ON "webhook_logs"("is_processed");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_login_history" ADD CONSTRAINT "user_login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_contacts" ADD CONSTRAINT "factory_contacts_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_destinations" ADD CONSTRAINT "delivery_destinations_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "material_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_categories" ADD CONSTRAINT "material_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "material_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_follow_ups" ADD CONSTRAINT "inquiry_follow_ups_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_model_code_id_fkey" FOREIGN KEY ("model_code_id") REFERENCES "model_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_status_history" ADD CONSTRAINT "product_status_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specifications_multilingual" ADD CONSTRAINT "specifications_multilingual_specification_id_fkey" FOREIGN KEY ("specification_id") REFERENCES "specifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom" ADD CONSTRAINT "bom_specification_id_fkey" FOREIGN KEY ("specification_id") REFERENCES "specifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodboard_items" ADD CONSTRAINT "moodboard_items_moodboard_id_fkey" FOREIGN KEY ("moodboard_id") REFERENCES "moodboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_tag_links" ADD CONSTRAINT "asset_tag_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset_library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_tag_links" ADD CONSTRAINT "asset_tag_links_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "asset_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photography_items" ADD CONSTRAINT "photography_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "photography_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_moq_tiers" ADD CONSTRAINT "quotation_moq_tiers_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_cost_breakdowns" ADD CONSTRAINT "quotation_cost_breakdowns_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_approval_history" ADD CONSTRAINT "quotation_approval_history_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_multilingual" ADD CONSTRAINT "quotation_multilingual_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_pdf_outputs" ADD CONSTRAINT "quotation_pdf_outputs_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_items" ADD CONSTRAINT "po_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "po_allocations" ADD CONSTRAINT "po_allocations_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wo_items" ADD CONSTRAINT "wo_items_wo_id_fkey" FOREIGN KEY ("wo_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "so_items" ADD CONSTRAINT "so_items_so_id_fkey" FOREIGN KEY ("so_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_change_history" ADD CONSTRAINT "sales_order_change_history_so_id_fkey" FOREIGN KEY ("so_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_revisions" ADD CONSTRAINT "sample_revisions_sample_production_id_fkey" FOREIGN KEY ("sample_production_id") REFERENCES "sample_productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_lot_id_fkey" FOREIGN KEY ("inventory_lot_id") REFERENCES "inventory_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_goods_movements" ADD CONSTRAINT "finished_goods_movements_finished_goods_id_fkey" FOREIGN KEY ("finished_goods_id") REFERENCES "finished_goods_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_consumption_records" ADD CONSTRAINT "factory_consumption_records_factory_consigned_id_fkey" FOREIGN KEY ("factory_consigned_id") REFERENCES "factory_consigned_inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktaking_items" ADD CONSTRAINT "stocktaking_items_stocktaking_id_fkey" FOREIGN KEY ("stocktaking_id") REFERENCES "stocktakings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_invoices" ADD CONSTRAINT "commercial_invoices_trade_transaction_id_fkey" FOREIGN KEY ("trade_transaction_id") REFERENCES "trade_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_invoice_items" ADD CONSTRAINT "commercial_invoice_items_commercial_invoice_id_fkey" FOREIGN KEY ("commercial_invoice_id") REFERENCES "commercial_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_lists" ADD CONSTRAINT "packing_lists_trade_transaction_id_fkey" FOREIGN KEY ("trade_transaction_id") REFERENCES "trade_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_list_items" ADD CONSTRAINT "packing_list_items_packing_list_id_fkey" FOREIGN KEY ("packing_list_id") REFERENCES "packing_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates_of_origin" ADD CONSTRAINT "certificates_of_origin_trade_transaction_id_fkey" FOREIGN KEY ("trade_transaction_id") REFERENCES "trade_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fta_applications" ADD CONSTRAINT "fta_applications_trade_transaction_id_fkey" FOREIGN KEY ("trade_transaction_id") REFERENCES "trade_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills_of_lading" ADD CONSTRAINT "bills_of_lading_trade_transaction_id_fkey" FOREIGN KEY ("trade_transaction_id") REFERENCES "trade_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "air_waybills" ADD CONSTRAINT "air_waybills_trade_transaction_id_fkey" FOREIGN KEY ("trade_transaction_id") REFERENCES "trade_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_declarations" ADD CONSTRAINT "customs_declarations_trade_transaction_id_fkey" FOREIGN KEY ("trade_transaction_id") REFERENCES "trade_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_document_files" ADD CONSTRAINT "trade_document_files_trade_transaction_id_fkey" FOREIGN KEY ("trade_transaction_id") REFERENCES "trade_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_classification_logs" ADD CONSTRAINT "email_classification_logs_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
