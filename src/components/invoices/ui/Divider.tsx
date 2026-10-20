import React from 'react';
import { View, StyleSheet } from '@react-pdf/renderer';
import { colors, spacing } from '../theme/invoiceTheme';

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    width: '100%',
  }
});

interface DividerProps {
  style?: any;
}

export const Divider = ({ style }: DividerProps) => (
  <View style={[styles.divider, style]} />
);
