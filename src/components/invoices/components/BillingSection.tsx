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
  row: {
    flexDirection: 'row',
    marginBottom: 3.5,
  },
  label: {
    fontSize: 8.5,
    color: colors.secondaryText,
  },
  colon: {
    width: 10,
    fontSize: 8.5,
    color: colors.secondaryText,
  },
  value: {
    flex: 1,
    fontSize: 8.5,
    fontWeight: 700,
    color: colors.primaryText,
  },
});

interface BillingSectionProps {
  viewModel: InvoiceViewModel;
}

export const BillingSection = ({ viewModel }: BillingSectionProps) => {
  // The label column fits the longest label on one line (about 5.3 pt per character at this size).
  const longest = Math.max(4, ...viewModel.print.billTo.rows.map((r) => r.label.length));
  const labelWidth = Math.min(140, Math.round(longest * 5.3) + 6);
  return (
    <View style={styles.container}>
      {/* Bill To */}
      <View style={styles.column}>
        <View style={styles.headerBox}>
          <Text style={styles.headerText}>BILL TO</Text>
        </View>
        {/* "Name / Company : Nandha", "Phone : …", "Address : …": only the filled-in ones. */}
        {viewModel.print.billTo.rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text style={[styles.label, { width: labelWidth }]}>{r.label}</Text>
            <Text style={styles.colon}>:</Text>
            <Text style={styles.value}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};
