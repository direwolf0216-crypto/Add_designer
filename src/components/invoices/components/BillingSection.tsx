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
    fontSize: 10,
    fontWeight: 700,
    color: colors.darkBox,
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 8,
    color: colors.primaryText,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  detailLabel: {
    fontSize: 8,
    width: 35,
    color: colors.secondaryText,
  },
  detailValue: {
    fontSize: 8,
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
        <Text style={styles.companyName}>{viewModel.clientName}</Text>
        <Text style={styles.addressLine}>45, Park Street,</Text>
        <Text style={styles.addressLine}>R.S. Puram, Coimbatore - 641 002</Text>
        <Text style={styles.addressLine}>Tamil Nadu, India</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone :</Text>
          <Text style={styles.detailValue}>{viewModel.clientPhone}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email :</Text>
          <Text style={styles.detailValue}>{viewModel.clientEmail || 'abcenterprises@gmail.com'}</Text>
        </View>

      </View>
    </View>
  );
};
