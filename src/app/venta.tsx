import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, errorMessage } from '@/lib/api';
import { money, priceWithTax, quantity } from '@/lib/format';
import type { CashOverview, Paginated, Product } from '@/lib/types';
import { MAX_LINES, useCart } from '@/state/cart';
import { useSession } from '@/state/session';
import { Banner, Button, HeaderLink } from '@/ui/components';
import { colors, radius, spacing } from '@/ui/theme';

const PAGE_SIZE = 40;

/** Coincidencia exacta por código, código de barras o códigos alternos (lector de barras). */
function exactMatch(products: Product[], term: string) {
  const value = term.trim().toUpperCase();
  return products.find(
    (product) =>
      product.code?.toUpperCase() === value ||
      product.barcode?.toUpperCase() === value ||
      product.codes?.some((code) => code.code.toUpperCase() === value)
  );
}

export default function Venta() {
  const { company } = useSession();
  const cart = useCart();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cash, setCash] = useState<CashOverview | null>(null);
  const [cashError, setCashError] = useState<string | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async (term: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api<Paginated<Product>>('/api/products', {
        query: { search: term.trim() || undefined, status: 'active', page: 1, pageSize: PAGE_SIZE },
      });
      if (id === requestId.current) {
        setProducts(result.items);
      }
      return result.items;
    } catch (err) {
      if (id === requestId.current) {
        setError(errorMessage(err));
      }
      return [];
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  // Busca mientras se escribe (con una pausa corta para no saturar la red).
  useEffect(() => {
    const timer = setTimeout(() => void load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  // Estado de la caja cada vez que se vuelve a esta pantalla.
  useFocusEffect(
    useCallback(() => {
      api<CashOverview>('/api/caja/overview')
        .then((overview) => {
          setCash(overview);
          setCashError(null);
        })
        .catch((err) => setCashError(errorMessage(err)));
    }, [])
  );

  const addProduct = (product: Product) => {
    if (cart.lines.length >= MAX_LINES && !cart.lines.some((line) => line.product.id === product.id)) {
      setNotice(`Máximo ${MAX_LINES} productos distintos por factura.`);
      return;
    }
    cart.add(product);
    setNotice(`Agregado: ${product.name}`);
  };

  // Enter (o el lector de barras, que termina con Enter): agrega si hay un solo resultado exacto.
  const submitSearch = async () => {
    const term = search.trim();
    if (!term) {
      return;
    }
    const found = exactMatch(products, term) ?? exactMatch(await load(term), term);
    if (found) {
      addProduct(found);
      setSearch('');
    } else if (products.length === 1) {
      addProduct(products[0]);
      setSearch('');
    } else {
      setNotice(`No hay un producto con el código "${term}".`);
    }
    inputRef.current?.focus();
  };

  const blockedReason =
    cash && !cash.saleSession ? cash.saleBlockedReason ?? 'No hay una caja abierta para este equipo.' : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {company?.commercialName ?? 'Venta'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {cash?.saleSession
              ? `${cash.saleSession.registerName ?? 'Caja'} abierta`
              : cash?.terminal
                ? `${cash.terminal.registerName} · sin abrir`
                : 'Caja sin vincular'}
          </Text>
        </View>
        <HeaderLink label="Caja" onPress={() => router.push('/caja')} />
        <HeaderLink label="Ajustes" onPress={() => router.push('/ajustes')} />
      </View>

      <View style={styles.searchBox}>
        <TextInput
          ref={inputRef}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder="Buscar o escanear código"
          placeholderTextColor={colors.muted}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit={false}
        />
        {loading ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
      </View>

      <View style={styles.messages}>
        {blockedReason ? (
          <Pressable onPress={() => router.push('/caja')}>
            <Banner tone="warning">{blockedReason} Toca para ir a Caja.</Banner>
          </Pressable>
        ) : null}
        {cashError ? <Banner tone="danger">Caja: {cashError}</Banner> : null}
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {notice ? (
          <Text style={styles.notice} numberOfLines={1}>
            {notice}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>{search ? 'Sin resultados.' : 'No hay productos activos.'}</Text> : null
        }
        renderItem={({ item }) => {
          const inCart = cart.lines.find((line) => line.product.id === item.id);
          const outOfStock = Boolean(item.controlsStock) && Number(item.stockQuantity) <= 0;
          return (
            <Pressable
              onPress={() => addProduct(item)}
              style={({ pressed }) => [styles.product, inCart && styles.productInCart, pressed && styles.pressed]}>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.productMeta} numberOfLines={1}>
                  {item.code}
                  {item.controlsStock ? ` · Exist.: ${quantity(Number(item.stockQuantity))}` : ''}
                  {outOfStock ? ' · AGOTADO' : ''}
                </Text>
              </View>
              <View style={styles.productRight}>
                <Text style={styles.price}>
                  {money(priceWithTax(Number(item.salePrice), Number(item.taxRate), Boolean(item.taxable)))}
                </Text>
                {inCart ? <Text style={styles.badge}>× {quantity(inCart.quantity)}</Text> : null}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <View style={styles.totals}>
          <Text style={styles.footerLabel}>
            {cart.lines.length} {cart.lines.length === 1 ? 'producto' : 'productos'}
          </Text>
          <Text style={styles.footerTotal}>{money(cart.totals.total)}</Text>
        </View>
        <Button
          label="Cobrar"
          variant="success"
          onPress={() => router.push('/cobro')}
          disabled={cart.lines.length === 0}
          style={styles.payButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
  },
  headerInfo: { flex: 1 },
  title: { color: colors.primaryText, fontSize: 17, fontWeight: '700' },
  subtitle: { color: '#D6E4F7', fontSize: 13 },
  searchBox: { padding: spacing.md, paddingBottom: spacing.xs, justifyContent: 'center' },
  search: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingRight: 44,
    fontSize: 17,
    color: colors.text,
  },
  spinner: { position: 'absolute', right: spacing.md + 12, top: spacing.md + 16 },
  messages: { paddingHorizontal: spacing.md, gap: spacing.xs },
  notice: { color: colors.success, fontSize: 13, fontWeight: '600' },
  list: { padding: spacing.md, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: spacing.xl },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 64,
  },
  productInCart: { borderColor: colors.success, backgroundColor: '#F5FBF7' },
  pressed: { opacity: 0.7 },
  productInfo: { flex: 1, gap: 2 },
  productName: { fontSize: 16, fontWeight: '600', color: colors.text },
  productMeta: { fontSize: 13, color: colors.muted },
  productRight: { alignItems: 'flex-end', gap: 2 },
  price: { fontSize: 16, fontWeight: '700', color: colors.text },
  badge: { fontSize: 13, fontWeight: '700', color: colors.success },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totals: { flex: 1 },
  footerLabel: { fontSize: 13, color: colors.muted },
  footerTotal: { fontSize: 22, fontWeight: '800', color: colors.text },
  payButton: { flex: 1 },
});
