import React from 'react';
import { View, Text, StyleSheet, Image as PdfImage } from '@react-pdf/renderer';
import { InvoiceViewModel } from '../types/invoiceViewModel';
import path from 'path';
import { colors, typography } from '../theme/invoiceTheme';

// The shop's real Google review QR code (rendered on the server, so a file path works).
const REVIEW_QR = path.join(process.cwd(), 'public', 'assets', 'Add_Designer_Google_Review_QR.png');

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 10,
  },
  leftCol: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  thankYouLarge: {
    fontFamily: typography.cursiveFamily,
    fontSize: 28,
    color: '#E11D48',
  },
  thankYouSmall: {
    fontFamily: typography.cursiveFamily,
    fontSize: 16,
    color: colors.darkBox,
    marginTop: -2,
    marginLeft: 16,
  },
  midCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qrWrapper: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  feedbackTextWrapper: {
    flexDirection: 'column',
  },
  feedbackTextBold: {
    fontSize: 7,
    fontWeight: 700,
    color: colors.darkBox,
    marginBottom: 2,
  },
  feedbackText: {
    fontSize: 7,
    color: colors.darkBox,
  },
  rightCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  signCompany: {
    fontSize: 8,
    fontWeight: 700,
    color: colors.darkBox,
    marginBottom: 25,
  },
  signLine: {
    width: 120,
    height: 1,
    backgroundColor: colors.darkBox,
    marginBottom: 4,
  },
  signLabel: {
    fontSize: 7,
    fontWeight: 700,
    color: colors.darkBox,
  }
});

interface FooterProps {
  viewModel: InvoiceViewModel;
}

export const Footer = ({ viewModel }: FooterProps) => {
  return (
    <View wrap={false} style={{ marginTop: 'auto' }}>
      <View style={styles.container}>
        <View style={styles.leftCol}>
          <Text style={styles.thankYouLarge}>Thank you!</Text>
          <Text style={styles.thankYouSmall}>for your business...</Text>
        </View>

        <View style={styles.midCol}>
          <View style={styles.qrWrapper}>
            <PdfImage src={viewModel.print.business.reviewQr || REVIEW_QR} style={styles.qrImage} />
          </View>
          <View style={styles.feedbackTextWrapper}>
            <Text style={styles.feedbackTextBold}>We value your feedback!</Text>
            <Text style={styles.feedbackText}>Scan the QR code</Text>
            <Text style={styles.feedbackText}>to review us on</Text>
            <Text style={styles.feedbackText}>Google</Text>
          </View>
        </View>

        <View style={styles.rightCol}>
          <Text style={styles.signCompany}>For {viewModel.print.business.name.toUpperCase()}</Text>
          <View style={styles.signLine}></View>
          <Text style={styles.signLabel}>Authorised Signatory</Text>
        </View>
      </View>
    </View>
  );
};
