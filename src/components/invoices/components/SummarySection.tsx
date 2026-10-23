import React from 'react';
import { View, Text, StyleSheet, Image as PdfImage } from '@react-pdf/renderer';
import { InvoiceViewModel } from '../types/invoiceViewModel';
import { colors } from '../theme/invoiceTheme';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  leftCol: {
    width: '55%',
    flexDirection: 'row',
    gap: 20,
  },
  termsCol: {
    flex: 1,
  },
  bankCol: {
    flex: 1,
  },
  headerBox: {
    backgroundColor: colors.darkBox,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  headerText: {
    color: colors.white,
    fontSize: 7,
    fontWeight: 700,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bulletText: {
    fontSize: 7,
    color: colors.primaryText,
    marginLeft: 4,
  },
  bankRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bankLabel: {
    fontSize: 7,
    color: colors.secondaryText,
    width: 50,
  },
  bankValue: {
    fontSize: 7,
    color: colors.primaryText,
    fontWeight: 700,
  },
  rightCol: {
    width: '40%',
  },
  summaryTable: {
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  summaryLabel: {
    width: '50%',
    padding: 6,
    fontSize: 8,
    fontWeight: 700,
    backgroundColor: '#F9FAFB',
    color: colors.primaryText,
  },
  summaryValue: {
    width: '50%',
    padding: 6,
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'right',
    color: colors.primaryText,
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: colors.darkBox,
    padding: 10,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  totalLabel: {
    width: '50%',
    fontSize: 12,
    fontWeight: 700,
    color: colors.white,
  },
  totalValue: {
    width: '50%',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'right',
    color: colors.white,
  },
  paymentsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  paymentsText: {
    fontSize: 8,
    color: colors.secondaryText,
  },
  paymentsTextBold: {
    fontSize: 8,
    fontWeight: 700,
    color: colors.darkBox,
  },
  amountInWords: {
    marginTop: 10,
  },
  // Kept inside the bank column: the text block shrinks and wraps instead of running under the totals.
  payQrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    maxWidth: '100%',
  },
  payQrImage: {
    width: 54,
    height: 54,
    flexShrink: 0,
  },
  payQrTextCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  payQrTitle: {
    fontSize: 7,
    fontWeight: 700,
    color: colors.darkBox,
    marginBottom: 2,
  },
  payQrText: {
    fontSize: 7,
    color: colors.secondaryText,
  },
  amountInWordsLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: colors.darkBox,
    marginBottom: 2,
  },
  amountInWordsValue: {
    fontSize: 8,
    color: colors.secondaryText,
  }
});

interface SummarySectionProps {
  viewModel: InvoiceViewModel;
}

export const SummarySection = ({ viewModel }: SummarySectionProps) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftCol}>
        <View style={styles.termsCol}>
          <View style={styles.headerBox}>
            <Text style={styles.headerText}>TERMS & CONDITIONS</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={{ fontSize: 7 }}>•</Text>
            <Text style={styles.bulletText}>Payment must be made within the due date.</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={{ fontSize: 7 }}>•</Text>
            <Text style={styles.bulletText}>Goods once sold will not be taken back.</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={{ fontSize: 7 }}>•</Text>
            <Text style={styles.bulletText}>Design approval must be checked before printing.</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={{ fontSize: 7 }}>•</Text>
            <Text style={styles.bulletText}>We are not responsible for any spelling mistakes once design is approved.</Text>
          </View>
        </View>

        {(viewModel.print.business.bank.length > 0 || viewModel.print.payQr) && (
          <View style={styles.bankCol}>
            {viewModel.print.business.bank.length > 0 && (
              <View style={styles.headerBox}>
                <Text style={styles.headerText}>BANK DETAILS</Text>
              </View>
            )}
            {viewModel.print.business.bank.map((row) => (
              <View key={row.label} style={styles.bankRow}>
                <Text style={styles.bankLabel}>{row.label}</Text>
                <Text style={styles.bankValue}>: {row.value}</Text>
              </View>
            ))}
            {viewModel.print.payQr && (
              <View style={styles.payQrBox} wrap={false}>
                <PdfImage src={viewModel.print.payQr.image} style={styles.payQrImage} />
                <View style={styles.payQrTextCol}>
                  <Text style={styles.payQrTitle}>PAY WITH GPAY / UPI</Text>
                  <Text style={styles.payQrText}>{viewModel.print.payQr.caption}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.rightCol}>
        <View style={styles.summaryTable}>
          {viewModel.print.summary.map((row) => (
            <View key={row.label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{row.label}</Text>
              <Text style={styles.summaryValue}>{row.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
          <Text style={styles.totalValue}>{viewModel.print.total}</Text>
        </View>

        {viewModel.print.showPayments && (
          <View style={styles.paymentsRow}>
            <Text style={styles.paymentsText}>Paid: {viewModel.print.paid}</Text>
            {viewModel.print.showBalance && <Text style={styles.paymentsTextBold}>Balance Due: {viewModel.print.balance}</Text>}
          </View>
        )}

        <View style={styles.amountInWords}>
          <Text style={styles.amountInWordsLabel}>Amount in Words:</Text>
          <Text style={styles.amountInWordsValue}>{viewModel.print.amountInWords}</Text>
        </View>
      </View>
    </View>
  );
};
