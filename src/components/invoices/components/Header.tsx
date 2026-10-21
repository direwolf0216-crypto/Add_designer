import React from 'react';
import { View, Text, StyleSheet, Image as PdfImage } from '@react-pdf/renderer';
import { InvoiceViewModel } from '../types/invoiceViewModel';
import { colors } from '../theme/invoiceTheme';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderTopWidth: 8,
    borderTopColor: colors.darkBox,
    paddingTop: 20,
  },
  leftCol: {
    width: '60%',
  },
  logoImage: {
    width: 220,
    height: 60,
    objectFit: 'contain',
    marginBottom: 10,
  },
  servicesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  serviceTag: {
    fontSize: 7,
    fontWeight: 700,
    color: colors.darkBox,
  },
  rightCol: {
    width: '35%',
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: 900,
    color: colors.darkBox,
    letterSpacing: 2,
    marginBottom: 12,
  },
  metaTable: {
    width: 200,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  metaRowLast: {
    flexDirection: 'row',
  },
  metaLabel: {
    width: '40%',
    padding: 4,
    fontSize: 8,
    fontWeight: 700,
    backgroundColor: '#F9FAFB',
    color: colors.secondaryText,
  },
  metaValue: {
    width: '60%',
    padding: 4,
    fontSize: 8,
    textAlign: 'right',
    color: colors.primaryText,
  },
  contactBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    marginBottom: 20,
  },
  contactItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  contactItemFirst: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  contactText: {
    fontSize: 7,
    color: colors.darkBox,
    marginLeft: 4,
  }
});

interface HeaderProps {
  viewModel: InvoiceViewModel;
}

import { logoBase64 } from '../utils/logoBase64';

export const Header = ({ viewModel }: HeaderProps) => {
  const b = viewModel.print.business;
  // The contact bar shows only what the shop has filled in under Settings.
  const contact = [
    b.addressLines.length ? b.addressLines.join('\n') : '',
    b.phones.join('\n'),
    b.email,
    b.website,
  ].filter(Boolean);
  return (
    <View>
      <View style={styles.container}>
        <View style={styles.leftCol}>
          <PdfImage src={logoBase64} style={styles.logoImage} />
          <View style={styles.servicesRow}>
            <Text style={styles.serviceTag}>OFFSET PRINTING</Text>
            <Text style={styles.serviceTag}>DIGITAL PRINTING</Text>
            <Text style={styles.serviceTag}>XEROX | BINDING</Text>
            <Text style={styles.serviceTag}>LAMINATION</Text>
          </View>
          {b.gstin ? <Text style={[styles.serviceTag, { marginTop: 6, fontWeight: 600 }]}>GSTIN: {b.gstin}</Text> : null}
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <View style={styles.metaTable}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice No.</Text>
              <Text style={styles.metaValue}>{viewModel.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice Date</Text>
              <Text style={styles.metaValue}>{viewModel.formattedInvoiceDate}</Text>
            </View>
            <View style={styles.metaRowLast}>
              <Text style={styles.metaLabel}>Due Date</Text>
              <Text style={styles.metaValue}>{viewModel.print.dueDate}</Text>
            </View>
          </View>
        </View>
      </View>

      {contact.length > 0 ? (
        <View style={styles.contactBar}>
          {contact.map((line, i) => (
            <View key={i} style={i === 0 ? styles.contactItemFirst : styles.contactItem}>
              <Text style={styles.contactText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.contactBar, { paddingVertical: 0 }]} />
      )}
    </View>
  );
};
