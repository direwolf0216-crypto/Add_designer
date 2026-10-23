import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { InvoiceViewModel } from '../types/invoiceViewModel';
import { colors } from '../theme/invoiceTheme';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 40,
  },
  column: {
    flex: 1,
  },
  headerBox: {
    backgroundColor: colors.darkBox,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  headerText: {
    color: colors.white,
    fontSize: 8,
    fontWeight: 700,
  },
  companyName: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.darkBox,
    marginBottom: 3,
  },
  addressLine: {
    fontSize: 8.5,
    color: colors.primaryText,
    marginBottom: 1.5,
  },
  details: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2.5,
  },
  detailLabel: {
    fontSize: 7,
    width: 34,
    color: colors.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailValue: {
    fontSize: 8.5,
    fontWeight: 700,
    color: colors.primaryText,
  }
});

interface BillingSectionProps {
  viewModel: InvoiceViewModel;
}

export const BillingSection = ({ viewModel }: BillingSectionProps) => {
  return (
    <View style={styles.container}>
      {/* Bill To */}
      <View style={styles.column}>
        <View style={styles.headerBox}>
          <Text style={styles.headerText}>BILL TO</Text>
        </View>
        <Text style={styles.companyName}>{viewModel.print.billTo.name}</Text>
        {viewModel.print.billTo.lines.map((line, i) => (
          <Text key={i} style={styles.addressLine}>{line}</Text>
        ))}

        {/* Only what's known: an empty phone or email is left off, not printed as N/A. */}
        {(viewModel.print.billTo.phone || viewModel.print.billTo.email) && (
          <View style={styles.details}>
            {viewModel.print.billTo.phone ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>{viewModel.print.billTo.phone}</Text>
              </View>
            ) : null}
            {viewModel.print.billTo.email ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{viewModel.print.billTo.email}</Text>
              </View>
            ) : null}
          </View>
        )}

      </View>
    </View>
  );
};
