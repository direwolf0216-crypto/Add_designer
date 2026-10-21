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

const MIN_ROWS = 6;

interface InvoiceItemsTableProps {
  viewModel: InvoiceViewModel;
}

export const InvoiceItemsTable = ({ viewModel }: InvoiceItemsTableProps) => {
  const items = viewModel.print.items;

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
          <Text style={[styles.cell, styles.cellDesc]}>{item.description}</Text>
          <Text style={[styles.cell, styles.cellSize]}>{item.size}</Text>
          <Text style={[styles.cell, styles.cellQty]}>{item.qty}</Text>
          <Text style={[styles.cell, styles.cellRate]}>{item.rate}</Text>
          <Text style={[styles.cell, styles.cellAmount]}>{item.amount}</Text>
        </View>
      ))}

      {/* Empty ruled rows keep the table at the printed sheet's usual height for short orders. */}
      {Array.from({ length: Math.max(0, MIN_ROWS - items.length) }).map((_, i) => {
        const index = items.length + i;
        return (
          <View key={`empty-${i}`} style={[styles.tableRow, index % 2 !== 0 ? styles.tableRowAlt : {}]}>
            {[styles.cellSno, styles.cellDesc, styles.cellSize, styles.cellQty, styles.cellRate, styles.cellAmount].map((col, c) => (
              <Text key={c} style={[styles.cell, col]}> </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
};
