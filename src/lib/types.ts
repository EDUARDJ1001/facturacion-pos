// Formas de la API del backend de facturación (apps/backend). Solo los campos que usa el POS.

export interface AuthUser {
  sub: number;
  username: string;
  fullName: string;
  role: string;
}

export interface Company {
  id: number;
  code: string;
  commercialName: string;
  legalName: string;
  rtn: string;
  phone: string | null;
  address: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  companies: Company[];
  permissions: string[];
}

export interface MeResponse {
  user: AuthUser;
  companies: Company[];
  permissions: string[];
  activeCompany: Company | null;
}

export interface Product {
  id: number;
  code: string;
  barcode: string | null;
  name: string;
  type: 'PRODUCTO' | 'SERVICIO';
  unitMeasure: string;
  salePrice: number;
  taxable: number | boolean;
  taxRate: number;
  controlsStock: number | boolean;
  stockQuantity: number;
  codes: { code: string; codeType: string }[];
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number };
}

export interface CashTerminal {
  id: number;
  name: string;
  cashRegisterId: number;
  registerName: string;
}

export interface CashSession {
  id: number;
  cashRegisterId: number;
  registerName: string | null;
  openingAmount: number;
  openedAt: string;
  openedByName?: string | null;
}

export interface CashRegisterOverview {
  id: number;
  name: string;
  isActive: boolean | number;
  session: CashSession | null;
  summary: { cashIn: number; cashOut: number; expectedCash: number } | null;
  canOperate: boolean;
  canClose: boolean;
}

export interface CashOverview {
  registers: CashRegisterOverview[];
  terminal: CashTerminal | null;
  terminalStatus: 'none' | 'ok' | 'invalid' | 'network';
  clientIp: string | null;
  canManage: boolean;
  saleSession: CashSession | null;
  saleBlockedReason: string | null;
}

export type TenderMethod = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO';

export interface InvoiceItem {
  lineNumber: number;
  description: string;
  productCode: string | null;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineDiscount: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export interface InvoiceDetail {
  id: number;
  invoiceNumber: string;
  status: 'EMITIDA' | 'ANULADA';
  saleType: 'CONTADO' | 'CREDITO';
  issuedAt: string;
  printInvoiceDate: string;
  createdByName: string | null;
  printCustomerName: string;
  customerRtnSnapshot: string | null;
  companyLegalNameSnapshot: string;
  companyCommercialNameSnapshot: string;
  companyRtnSnapshot: string;
  companyEmailSnapshot: string | null;
  companyPhoneSnapshot: string | null;
  companyAddressSnapshot: string | null;
  caiSnapshot: string;
  issueDeadlineSnapshot: string;
  rangeStartSnapshot: number;
  rangeEndSnapshot: number;
  subtotal: number;
  discountTotal: number;
  taxableAmount15: number;
  taxableAmount18: number;
  exemptAmount: number;
  exoneratedAmount: number;
  isv15: number;
  isv18: number;
  taxTotal: number;
  grandTotal: number;
  totalInWords: string | null;
  notes: string | null;
  items: InvoiceItem[];
  settings?: {
    footerText: string | null;
    invoiceTitle: string | null;
    legendOriginal?: string;
    legendCopy?: string;
  };
}

export interface CreateInvoicePayload {
  customer: { name: string; rtn?: string };
  saleType: 'CONTADO';
  tenderMethod: TenderMethod;
  notes?: string;
  items: { productId?: number; description?: string; quantity: number; unitPrice?: number }[];
}
