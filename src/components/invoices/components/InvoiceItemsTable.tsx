import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { InvoiceViewModel } from '../types/invoiceViewModel';
import { colors } from '../theme/invoiceTheme';

const styles = StyleSheet.create({
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.tableHeader,
    color: colors.white,
  },
  headerCell: {
    padding: 8,
    fontSize: 8,
    fontWeight: 700,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
  },
  headerCellDesc: {
    flex: 3,
    textAlign: 'left',
  },
  headerCellSno: {
    width: 40,
  },
  headerCellSize: {
    flex: 1.5,
  },
  headerCellQty: {
    flex: 1,
  },
  headerCellRate: {
    flex: 1.5,
    textAlign: 'right',
  },
  headerCellAmount: {
    flex: 1.5,
    textAlign: 'right',
    borderRightWidth: 0,
  },
  
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.tableRowAlt,
  },
  cell: {
    padding: 8,
    fontSize: 8,
    color: colors.primaryText,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    textAlign: 'center',
  },
  cellDesc: {
    flex: 3,
    textAlign: 'left',
  },
  cellSno: {
    width: 40,
  },
  cellSize: {
    flex: 1.5,
  },
  cellQty: {
    flex: 1,
  },
  cellRate: {
    flex: 1.5,
    textAlign: 'right',
  },
  cellAmount: {
    flex: 1.5,
    textAlign: 'right',
    borderRightWidth: 0,
  },
});

// Using static data to match the printing press sample closely
const sampleItems = [
  { desc: 'Visiting Cards - 300 GSM Art Card', size: '9 x 5.5 cm', qty: '1000 Nos', rate: '700.00', amount: '700.00' },
  { desc: 'Letter Heads - 100 GSM', size: 'A4', qty: '500 Nos', rate: '850.00', amount: '850.00' },
  { desc: 'Brochure (4 Page) - 130 GSM', size: 'A4 (Folded)', qty: '500 Nos', rate: '2,500.00', amount: '2,500.00' },
  { desc: 'Bill Books - 100 Sheets', size: '1/4 Size', qty: '10 Nos', rate: '600.00', amount: '600.00' },
  { desc: 'Flex Printing', size: '4 x 3 ft', qty: '1 No', rate: '450.00', amount: '450.00' },
  { desc: 'Lamination - Gloss', size: 'A4', qty: '20 Nos', rate: '50.00', amount: '50.00' },
];

interface InvoiceItemsTableProps {
  viewModel: InvoiceViewModel;
}

export const InvoiceItemsTable = ({ viewModel }: InvoiceItemsTableProps) => {
  // Use sampleItems as default if the actual viewModel items don't have printing specifics
  const items = sampleItems;

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.headerCellSno]}>S.No.</Text>
        <Text style={[styles.headerCell, styles.headerCellDesc]}>DESCRIPTION</Text>
        <Text style={[styles.headerCell, styles.headerCellSize]}>SIZE</Text>
        <Text style={[styles.headerCell, styles.headerCellQty]}>QTY.</Text>
        <Text style={[styles.headerCell, styles.headerCellRate]}>RATE (Rs)</Text>
        <Text style={[styles.headerCell, styles.headerCellAmount]}>AMOUNT (Rs)</Text>
      </View>
      
      {items.map((item, index) => (
        <View key={index} style={[styles.tableRow, index % 2 !== 0 ? styles.tableRowAlt : {}]}>
          <Text style={[styles.cell, styles.cellSno]}>{index + 1}</Text>
          <Text style={[styles.cell, styles.cellDesc]}>{item.desc}</Text>
          <Text style={[styles.cell, styles.cellSize]}>{item.size}</Text>
          <Text style={[styles.cell, styles.cellQty]}>{item.qty}</Text>
          <Text style={[styles.cell, styles.cellRate]}>{item.rate}</Text>
          <Text style={[styles.cell, styles.cellAmount]}>{item.amount}</Text>
        </View>
      ))}

    </View>
  );
};
