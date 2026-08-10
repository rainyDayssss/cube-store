import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PaymentMethod } from "@/features/checkout/lib/checkout";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  ewallet: "E-wallet",
  bank_transfer: "Bank transfer",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1714",
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#2563eb",
    borderBottomStyle: "solid",
    paddingBottom: 16,
  },
  storeName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563eb",
    marginBottom: 4,
  },
  tagline: {
    fontSize: 9,
    color: "#6b6560",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#9c9590",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    color: "#6b6560",
  },
  value: {
    fontWeight: "bold",
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e4de",
    borderBottomStyle: "solid",
    paddingBottom: 6,
    marginBottom: 8,
    fontWeight: "bold",
    fontSize: 8,
    color: "#9c9590",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0ece6",
    borderBottomStyle: "solid",
  },
  colName: {
    flex: 3,
    fontSize: 10,
  },
  colQty: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
  },
  colPrice: {
    flex: 1.5,
    textAlign: "right",
    fontSize: 10,
  },
  colTotal: {
    flex: 1.5,
    textAlign: "right",
    fontSize: 10,
    fontWeight: "bold",
  },
  totalSection: {
    marginTop: 16,
    borderTopWidth: 2,
    borderTopColor: "#1a1714",
    borderTopStyle: "solid",
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 40,
    textAlign: "center",
    color: "#9c9590",
    fontSize: 9,
  },
});

export type ReceiptData = {
  orderNumber: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  deliveryAddress: string;
  customerName: string;
  createdAt?: string;
  items: { name: string; quantity: number; unitPrice: number }[];
};

const priceFmt = (n: number) =>
  `PHP ${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`;

const dateFmt = (iso?: string) => {
  if (!iso)
    return new Date().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.storeName}>Cube Store</Text>
          <Text style={styles.tagline}>
            Curious objects for mind and desk
          </Text>
        </View>

        {/* Order Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          <Text style={styles.orderNumber}>{data.orderNumber}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{dateFmt(data.createdAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment</Text>
            <Text style={styles.value}>
              {PAYMENT_LABELS[data.paymentMethod]}
            </Text>
          </View>
        </View>

        {/* Customer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{data.customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Delivery address</Text>
            <Text style={styles.value}>{data.deliveryAddress}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>Product</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {data.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colName}>{item.name}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{priceFmt(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>
                {priceFmt(item.unitPrice * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{priceFmt(data.totalAmount)}</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for your purchase! If you have any questions, contact us at
          support@cubestore.com
        </Text>
      </Page>
    </Document>
  );
}
