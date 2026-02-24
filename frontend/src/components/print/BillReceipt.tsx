import React, { useEffect, useState, useRef } from 'react';
import { billApi, restaurantApi, receiptApi } from '../../lib/api';

interface BillReceiptProps {
  billId: string;
  onClose: () => void;
}

export function BillReceipt({ billId, onClose }: BillReceiptProps) {
  const [bill, setBill]         = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      billApi.getOne(billId),
      restaurantApi.getMe(),
      receiptApi.get(),
    ]).then(([b, r, s]) => {
      setBill(b.data);
      setRestaurant(r.data);
      setSettings(s.data);
    }).finally(() => setLoading(false));
  }, [billId]);

  const handlePrint = () => {
    // Call the backend print counter
    billApi.print(billId).catch(() => {});
    window.print();
  };

  const fmt = (n: any) => `₹${Number(n ?? 0).toFixed(2)}`;
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const fmtTime = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const METHOD_LABELS: Record<string, string> = {
    CASH: 'Cash', CARD: 'Card', UPI: 'UPI', WALLET: 'Wallet', CREDIT: 'Credit',
  };

  return (
    <>
      {/* ── Screen overlay ───────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 no-print">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-800 text-base">Receipt Preview</h2>
              {bill && <p className="text-xs text-slate-400 mt-0.5">{bill.billNumber}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Receipt preview */}
          <div className="p-5">
            {loading ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-4 rounded" />)}
              </div>
            ) : bill ? (
              <ReceiptContent
                bill={bill}
                restaurant={restaurant}
                settings={settings}
                ref={printRef}
              />
            ) : (
              <p className="text-slate-400 text-sm text-center py-8">Failed to load receipt</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !bill}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              style={{ background: 'var(--accent)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>

      {/* ── Printable receipt (hidden on screen, visible only when printing) ─── */}
      {bill && (
        <div className="receipt-print-wrapper">
          <ReceiptContent
            bill={bill}
            restaurant={restaurant}
            settings={settings}
          />
        </div>
      )}
    </>
  );
}

// ── Receipt content (shared between preview and print) ──────────────────────

const ReceiptContent = React.forwardRef<HTMLDivElement, {
  bill: any;
  restaurant: any;
  settings: any;
}>(({ bill, restaurant, settings }, ref) => {
  const fmt = (n: any) => `₹${Number(n ?? 0).toFixed(2)}`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const METHOD_LABELS: Record<string, string> = {
    CASH: 'Cash', CARD: 'Card', UPI: 'UPI', WALLET: 'Wallet', CREDIT: 'Credit/Khata',
  };

  const order       = bill.order;
  const items       = order?.items ?? [];
  const payments    = bill.payments ?? [];
  const subtotal    = Number(bill.subtotal ?? 0);
  const taxTotal    = Number(bill.taxTotal ?? 0);
  const discount    = Number(bill.discountTotal ?? 0);
  const charges     = Number(bill.chargesTotal ?? 0);
  const grandTotal  = Number(bill.grandTotal ?? 0);
  const cgst        = taxTotal / 2;
  const sgst        = taxTotal / 2;
  const showGst     = settings?.showGstBreakdown !== false && taxTotal > 0;
  const totalPaid   = payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const change      = Math.max(0, totalPaid - grandTotal);

  // Header lines — fall back to restaurant name/address
  const h1 = settings?.headerLine1 || restaurant?.name || 'Restaurant';
  const h2 = settings?.headerLine2 || restaurant?.address || '';
  const h3 = settings?.headerLine3 || (restaurant?.city ? `${restaurant.city}` : '');

  return (
    <div ref={ref} className="receipt-content font-mono text-black bg-white">
      {/* Restaurant header */}
      <div className="receipt-center receipt-bold receipt-xl">{h1}</div>
      {h2 && <div className="receipt-center receipt-sm">{h2}</div>}
      {h3 && <div className="receipt-center receipt-sm">{h3}</div>}
      {restaurant?.phone && <div className="receipt-center receipt-sm">Ph: {restaurant.phone}</div>}

      {/* GSTIN / FSSAI */}
      {settings?.showGstBreakdown !== false && restaurant?.gstin && (
        <div className="receipt-center receipt-sm">GSTIN: {restaurant.gstin}</div>
      )}
      {settings?.showFssai !== false && restaurant?.fssaiNumber && (
        <div className="receipt-center receipt-sm">FSSAI: {restaurant.fssaiNumber}</div>
      )}

      <div className="receipt-divider" />

      {/* Bill meta */}
      <div className="receipt-row receipt-sm">
        <span>Bill No:</span><span>{bill.billNumber}</span>
      </div>
      <div className="receipt-row receipt-sm">
        <span>Date:</span><span>{fmtDate(bill.createdAt)}</span>
      </div>
      <div className="receipt-row receipt-sm">
        <span>Time:</span><span>{fmtTime(bill.createdAt)}</span>
      </div>
      {order?.table?.number && settings?.showTableNumber !== false && (
        <div className="receipt-row receipt-sm">
          <span>Table:</span><span>{order.table.number}{order.table.section ? ` (${order.table.section})` : ''}</span>
        </div>
      )}
      {order?.tokenNumber && (
        <div className="receipt-row receipt-sm">
          <span>Token:</span><span>#{order.tokenNumber}</span>
        </div>
      )}
      {order?.customerName && settings?.showCustomerName !== false && (
        <div className="receipt-row receipt-sm">
          <span>Customer:</span><span>{order.customerName}</span>
        </div>
      )}
      {order?.orderType && (
        <div className="receipt-row receipt-sm">
          <span>Type:</span>
          <span>{{ DINE_IN: 'Dine In', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery', COMPLIMENTARY: 'Complimentary' }[order.orderType as string] ?? order.orderType}</span>
        </div>
      )}

      <div className="receipt-divider" />

      {/* Items header */}
      <div className="receipt-items-header receipt-sm receipt-bold">
        <span>Item</span><span>Qty</span><span>Amt</span>
      </div>
      <div className="receipt-thin-divider" />

      {/* Items */}
      {items.map((item: any) => (
        <div key={item.id} className="receipt-item receipt-sm">
          <span className="receipt-item-name">{item.itemName}</span>
          <span className="receipt-item-qty">×{item.quantity}</span>
          <span className="receipt-item-price">{fmt(Number(item.unitPrice) * item.quantity)}</span>
        </div>
      ))}

      <div className="receipt-divider" />

      {/* Totals */}
      <div className="receipt-row receipt-sm">
        <span>Subtotal</span><span>{fmt(subtotal)}</span>
      </div>
      {discount > 0 && (
        <div className="receipt-row receipt-sm">
          <span>Discount</span><span>-{fmt(discount)}</span>
        </div>
      )}
      {charges > 0 && (
        <div className="receipt-row receipt-sm">
          <span>Charges</span><span>+{fmt(charges)}</span>
        </div>
      )}
      {showGst ? (
        <>
          <div className="receipt-row receipt-sm">
            <span>CGST</span><span>{fmt(cgst)}</span>
          </div>
          <div className="receipt-row receipt-sm">
            <span>SGST</span><span>{fmt(sgst)}</span>
          </div>
        </>
      ) : taxTotal > 0 ? (
        <div className="receipt-row receipt-sm">
          <span>Tax</span><span>{fmt(taxTotal)}</span>
        </div>
      ) : null}

      <div className="receipt-divider" />

      <div className="receipt-row receipt-bold receipt-lg">
        <span>TOTAL</span><span>{fmt(grandTotal)}</span>
      </div>

      <div className="receipt-divider" />

      {/* Payments */}
      {payments.length > 0 && (
        <>
          {payments.map((p: any, i: number) => (
            <div key={i} className="receipt-row receipt-sm">
              <span>{METHOD_LABELS[p.method] ?? p.method}{p.splitLabel ? ` (${p.splitLabel})` : ''}</span>
              <span>{fmt(p.amount)}</span>
            </div>
          ))}
          {change > 0.01 && (
            <div className="receipt-row receipt-sm">
              <span>Change</span><span>{fmt(change)}</span>
            </div>
          )}
        </>
      )}

      <div className="receipt-divider" />

      {/* Footer */}
      {(settings?.footerLine1 || settings?.footerLine2 || settings?.footerLine3) ? (
        <>
          {settings.footerLine1 && <div className="receipt-center receipt-sm">{settings.footerLine1}</div>}
          {settings.footerLine2 && <div className="receipt-center receipt-sm">{settings.footerLine2}</div>}
          {settings.footerLine3 && <div className="receipt-center receipt-sm">{settings.footerLine3}</div>}
        </>
      ) : (
        <>
          <div className="receipt-center receipt-sm">Thank you for visiting!</div>
          <div className="receipt-center receipt-sm">Please visit again</div>
        </>
      )}

      <div className="receipt-divider" />
      <div className="receipt-center receipt-xs">Powered by RestroSync</div>
    </div>
  );
});

ReceiptContent.displayName = 'ReceiptContent';
