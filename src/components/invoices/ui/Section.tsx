import React from 'react';
import { View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
    paddingHorizontal: 40,
  }
});

interface SectionProps {
  children: React.ReactNode;
  style?: any;
  wrap?: boolean;
}

export const Section = ({ children, style, wrap = true }: SectionProps) => (
  <View style={[styles.section, style]} wrap={wrap}>
    {children}
  </View>
);
