// Datos de pago manual de Carive. Actualiza aquí tus cuentas.
// Estos son los que verá el cliente al elegir un plan pagado.

export const PAYMENT_METHODS_INFO = [
  {
    id: "zelle",
    name: "Zelle",
    detail: "fernandob@qualitymarinegroup.com",
    note: "Envía a nombre de Fernando Bavuso",
    currency: "USD",
  },
  {
    id: "paypal",
    name: "PayPal",
    detail: "fernandob@qualitymarinegroup.com",
    note: "Marca como 'Enviar a un amigo' si es posible",
    currency: "USD",
  },
  {
    id: "transfer",
    name: "Transferencia bancaria",
    detail: "Solicita los datos por WhatsApp: 305-799-7996",
    note: "Para transferencias ACH / wire en EE.UU.",
    currency: "USD",
  },
  {
    id: "usdt",
    name: "USDT / Binance (Venezuela)",
    detail: "Binance Pay ID / wallet USDT — pídelo por WhatsApp: 305-799-7996",
    note: "Red TRC-20. Ideal para pagos desde Venezuela.",
    currency: "USDT",
  },
];
