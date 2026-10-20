import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
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
  amountInWords: {
    marginTop: 10,
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

        <View style={styles.bankCol}>
          <View style={styles.headerBox}>
            <Text style={styles.headerText}>BANK DETAILS</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>Bank Name</Text>
            <Text style={styles.bankValue}>: HDFC Bank</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>A/c Name</Text>
            <Text style={styles.bankValue}>: ADDESIGNER Laser Printer</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>A/c No.</Text>
            <Text style={styles.bankValue}>: 1234 5678 9012 34</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>IFSC Code</Text>
            <Text style={styles.bankValue}>: HDFC0001234</Text>
          </View>
          <View style={styles.bankRow}>
            <Text style={styles.bankLabel}>Branch</Text>
            <Text style={styles.bankValue}>: Coimbatore - Main</Text>
          </View>
        </View>
      </View>

      <View style={styles.rightCol}>
        <View style={styles.summaryTable}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>SUB TOTAL</Text>
            <Text style={styles.summaryValue}>Rs 5,150.00</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>DISCOUNT</Text>
            <Text style={styles.summaryValue}>Rs 150.00</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>CGST (9%)</Text>
            <Text style={styles.summaryValue}>Rs 450.00</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>SGST (9%)</Text>
            <Text style={styles.summaryValue}>Rs 450.00</Text>
          </View>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
          <Text style={styles.totalValue}>Rs 5,900.00</Text>
        </View>
        
        <View style={styles.amountInWords}>
          <Text style={styles.amountInWordsLabel}>Amount in Words:</Text>
          <Text style={styles.amountInWordsValue}>Rupees Five Thousand Nine Hundred Only</Text>
        </View>
      </View>
    </View>
  );
};
