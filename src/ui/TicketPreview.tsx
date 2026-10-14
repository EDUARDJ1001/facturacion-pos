import { Platform, StyleSheet, Text, View } from 'react-native';

import { TICKET_COLUMNS, type TicketLine } from '@/lib/ticket';
import { colors } from './theme';

const FONT = Platform.select({ android: 'monospace', default: 'Courier' });
const FONT_SIZE = { sm: 11, md: 13, lg: 16 } as const;

/** Vista previa del ticket de 58 mm (aproximada: la impresora usa su propia letra). */
export function TicketPreview({ lines }: { lines: TicketLine[] }) {
  return (
    <View style={styles.paper}>
      {lines.map((line, index) => {
        switch (line.kind) {
          case 'text':
            return (
              <Text
                key={index}
                style={[
                  styles.text,
                  { fontSize: FONT_SIZE[line.size ?? 'md'], textAlign: line.align ?? 'left' },
                  line.bold && styles.bold,
                ]}>
                {line.text}
              </Text>
            );
          case 'row':
            return (
              <View key={index} style={styles.row}>
                <Text style={[styles.text, styles.left, { fontSize: FONT_SIZE[line.size ?? 'md'] }, line.bold && styles.bold]}>
                  {line.left}
                </Text>
                <Text style={[styles.text, { fontSize: FONT_SIZE[line.size ?? 'md'] }, line.bold && styles.bold]}>
                  {line.right}
                </Text>
              </View>
            );
          case 'divider':
            return (
              <Text key={index} style={[styles.text, styles.divider]} numberOfLines={1}>
                {'-'.repeat(TICKET_COLUMNS)}
              </Text>
            );
          case 'feed':
            return <View key={index} style={{ height: line.lines * 6 }} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    alignSelf: 'center',
    width: 280,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  text: { fontFamily: FONT, color: '#111111' },
  bold: { fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  left: { flexShrink: 1 },
  divider: { fontSize: 11, textAlign: 'center' },
});
