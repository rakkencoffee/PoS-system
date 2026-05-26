'use client';

import React from 'react';

interface ReceiptItem {
  id?: number;
  menuItem?: { name: string };
  name?: string;
  quantity: number;
  price?: number;
  subtotal?: number;
  size?: string;
  notes?: string;
}

interface ReceiptProps {
  orderId: string;
  queueNumber: string | number;
  items: ReceiptItem[];
  total: number;
  discount?: number;
  paymentMethod: string;
}

export const Receipt: React.FC<ReceiptProps> = ({
  orderId,
  queueNumber,
  items,
  total,
  discount = 0,
  paymentMethod,
}) => {
  const now = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div id="receipt-print-area" className="receipt-container">
      {/* Header */}
      <div className="receipt-header">
        <h1 className="receipt-brand">RAKKEN COFFEE</h1>
        <p className="receipt-subtitle">STARTFRIDAY SPECIALTY COFFEE</p>
        <p className="receipt-location">South Jakarta, Indonesia</p>
        <div className="receipt-divider-thick">===============================</div>
        <p className="receipt-date">{now}</p>
        <p className="receipt-id">ID: {orderId}</p>
      </div>

      <div className="receipt-divider-thick">===============================</div>

      {/* Queue Number */}
      <div className="receipt-queue-section">
        <div className="receipt-label">NOMOR ANTREAN</div>
        <div className="receipt-queue-big">#{String(queueNumber).padStart(3, '0')}</div>
      </div>

      <div className="receipt-divider-thick">===============================</div>

      {/* Items */}
      <div className="receipt-items-list">
        {items.map((item, idx) => (
          <div key={idx} className="receipt-item-group">
            <div className="receipt-item-main">
              <span className="receipt-qty">{item.quantity}x</span>
              <span className="receipt-name">{item.menuItem?.name || item.name || 'Item'}</span>
              <span className="receipt-price">{(item.price || item.subtotal || 0).toLocaleString('id-ID')}</span>
            </div>
            {item.size && item.size !== '-' && (
              <div className="receipt-variant">  └ Size: {item.size}</div>
            )}
            {item.notes && (
              <div className="receipt-note">  └ Note: {item.notes}</div>
            )}
          </div>
        ))}
      </div>

      <div className="receipt-divider-thin">-------------------------------</div>

      {/* Totals */}
      <div className="receipt-summary">
        {discount > 0 && (
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>Rp {(total + discount).toLocaleString('id-ID')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span>Diskon:</span>
              <span>-Rp {discount.toLocaleString('id-ID')}</span>
            </div>
            <div className="receipt-divider-thin" style={{ margin: '4px 0' }}>-------------------------------</div>
          </div>
        )}
        <div className="receipt-total-row">
          <span className="receipt-total-label">T O T A L</span>
          <span className="receipt-total-value">Rp {total.toLocaleString('id-ID')}</span>
        </div>
        <div className="receipt-payment">
          <span>Payment: {paymentMethod}</span>
        </div>
      </div>

      <div className="receipt-divider-thick">===============================</div>

      {/* Footer */}
      <div className="receipt-footer">
        <p className="receipt-thanks">*** TERIMA KASIH ***</p>
        <p>Silakan tunggu nomor Anda dipanggil.</p>
        <p className="receipt-feedback">Follow our IG: @rakkencoffee</p>
      </div>
      <div className="receipt-cut-guide">. . . . . . . . . . . . . . . .</div>
    </div>
  );
};

