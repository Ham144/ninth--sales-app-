import { useState } from "react";
import { http } from "../api/http";

export function SalesOrderDraft({ action, disabled }) {
  const [customerNo, setCustomerNo] = useState(action?.customer?.No || "");
  const [date, setDate] = useState(action?.requestDeliveryDate || "");
  const [note, setNote] = useState(action?.keterangan || "");
  const [lines, setLines] = useState(
    (action?.products || []).map((row) => ({ No: row.No, Name: row.Name, qty: row.qty || 1 })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  const setQty = (index, qty) => {
    setLines((rows) => rows.map((row, i) => (i === index ? { ...row, qty } : row)));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || done) return;
    setBusy(true);
    setError("");
    try {
      const created = await http("/api/v1/salesOrder/new", {
        method: "POST",
        body: {
          customer: String(customerNo || "").trim(),
          products: lines.map((row) => ({ No: row.No, Name: row.Name, qty: Number(row.qty) || 1 })),
          requestDeliveryDate: date,
          locationCode: action?.locationCode || undefined,
          keterangan: note,
        },
      });
      setDone({
        documentNo: created.DocumentNo,
        returnValue: created.return_value,
      });
    } catch (err) {
      setError(String(err.message || "Gagal mengirim sales order"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="so-draft sent">
        <p className="so-draft-title">Sales order terkirim</p>
        <p>
          <strong>{done.documentNo}</strong>
          {done.returnValue ? ` · ${done.returnValue}` : ""}
        </p>
      </div>
    );
  }

  return (
    <form className="so-draft" onSubmit={submit}>
      <p className="so-draft-title">Draf sales order</p>
      <p className="so-draft-hint">Belum ke NAV sampai Anda menekan Kirim.</p>
      <label>
        Customer
        <input
          value={customerNo}
          onChange={(event) => setCustomerNo(event.target.value)}
          disabled={disabled}
          required
        />
        {action?.customer?.Name ? <span className="so-draft-name">{action.customer.Name}</span> : null}
      </label>
      <label>
        Tanggal kirim
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={disabled} required />
      </label>
      <div className="so-draft-lines">
        {lines.map((row, index) => (
          <label key={`${row.No}-${index}`}>
            {row.No} {row.Name}
            <input
              type="number"
              min="1"
              value={row.qty}
              disabled={disabled}
              onChange={(event) => setQty(index, event.target.value)}
            />
          </label>
        ))}
      </div>
      <label>
        Keterangan
        <input value={note} onChange={(event) => setNote(event.target.value)} disabled={disabled} />
      </label>
      {error ? <p className="so-draft-error">{error}</p> : null}
      <button type="submit" disabled={disabled || busy || !lines.length}>
        {busy ? "Mengirim…" : "Kirim"}
      </button>
    </form>
  );
}
