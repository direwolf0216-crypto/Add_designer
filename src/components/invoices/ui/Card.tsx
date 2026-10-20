import React from 'react';
import { View, StyleSheet } from '@react-pdf/renderer';
import { colors, radius, spacing } from '../theme/invoiceTheme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  }
});

interface CardProps {
  children: React.ReactNode;
  style?: any;
  wrap?: boolean;
}

export const Card = ({ children, style, wrap = true }: CardProps) => (
  <View style={[styles.card, style]} wrap={wrap}>
    {children}
  </View>
);
