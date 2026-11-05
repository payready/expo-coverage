import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, View, useColorScheme } from 'react-native';
import { Button } from 'panelui-native/components/button';
import { Chip } from 'panelui-native/components/chip';
import { Text } from 'panelui-native/primitives/text';
import { LABEL, fmt, lineHit, pct } from '../lib/stats';
import type { CoverageData, Tab } from '../lib/types';
import { HEALTH, HIT_BG, MISS_BG, MONO, PLATFORM } from '../theme';

const ROW = 22;

interface Row {
  n: number;
  tokens: [string, number][];
  hits?: (number | null)[];
  hit: number | null;
}

export function Source({ data, path, tab, onClose }: { data: CoverageData; path: string; tab: Tab; onClose: () => void }) {
  const scheme = useColorScheme();
  const [missOnly, setMissOnly] = useState(false);
  const list = useRef<FlatList<Row>>(null);
  const cursor = useRef(-1);
  const file = data.files.find((f) => f.p === path);
  const lines = data.sources[path];
  const dots = tab === 'all' && data.platforms.length > 1;
  const sums = file && (file.sums[tab] ?? file.sums.all);

  const rows = useMemo<Row[]>(() => {
    if (!file || !lines) return [];
    return lines.map((tokens, i) => {
      const hits = file.lc[i + 1];
      return { n: i + 1, tokens, hits, hit: hits ? lineHit(hits, tab, data.platforms) : null };
    });
  }, [file, lines, tab, data.platforms]);

  const shown = useMemo(() => (missOnly ? rows.filter((r) => r.hit === 0) : rows), [rows, missOnly]);
  const missCount = useMemo(() => rows.filter((r) => r.hit === 0).length, [rows]);

  const jump = (reset = false) => {
    const misses = shown.map((r, i) => (r.hit === 0 ? i : -1)).filter((i) => i >= 0);
    if (!misses.length) return;
    cursor.current = reset ? 0 : (cursor.current + 1) % misses.length;
    list.current?.scrollToIndex({ index: misses[cursor.current] ?? 0, viewPosition: 0.4, animated: !reset });
  };

  useEffect(() => {
    const t = setTimeout(() => jump(true), 80);
    return () => clearTimeout(t);
  }, [path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'n') jump();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const color = (i: number) => data.palette[i]?.[scheme === 'dark' ? 1 : 0] ?? undefined;

  return (
    <View style={{ position: 'fixed' as 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View className="absolute inset-y-0 right-0 bg-card" style={{ width: '100%', maxWidth: 940, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 40 }}>
        <View className="flex-row items-start gap-3 border-b border-border px-5 py-4">
          <View className="min-w-0 flex-1">
            <Text className="text-base font-semibold text-foreground">{path}</Text>
            {sums && (
              <Text className="mt-1 text-muted-foreground">
                {pct(sums.l).toFixed(1)}% of lines · {fmt(sums.l[1] - sums.l[0])} missed · {sums.f[0]}/{sums.f[1]} functions · {sums.b[0]}/{sums.b[1]} branches
              </Text>
            )}
          </View>
          <Button variant="ghost" size="sm" onPress={onClose} accessibilityLabel="Close">
            Close
          </Button>
        </View>
        <View className="flex-row flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
          <Chip selected={missOnly} onPress={() => setMissOnly((v) => !v)}>
            Only missed lines
          </Chip>
          <Chip onPress={() => jump()}>Next missed line (n)</Chip>
          <View className="flex-1" />
          <Text className="text-muted-foreground">{missCount} missed</Text>
          {dots && (
            <View className="flex-row flex-wrap items-center gap-x-2.5 gap-y-1" accessibilityLabel={`Dots show which ran each line: ${data.platforms.map((p) => LABEL[p]).join(', ')}`}>
              {data.platforms.map((p) => (
                <View key={p} className="flex-row items-center gap-1">
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: PLATFORM[p] }} />
                  <Text className="text-xs text-muted-foreground">{LABEL[p]}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {!lines ? (
          <Text className="p-9 text-center text-muted-foreground">Source file not found on the machine that built this report.</Text>
        ) : (
          <ScrollView horizontal className="flex-1" contentContainerStyle={{ minWidth: '100%' }}>
            <FlatList
              ref={list}
              data={shown}
              keyExtractor={(r) => String(r.n)}
              getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
              initialNumToRender={60}
              windowSize={12}
              onScrollToIndexFailed={() => {}}
              renderItem={({ item: r }) => (
                <View style={{ height: ROW, flexDirection: 'row', alignItems: 'center', backgroundColor: r.hit === null ? undefined : r.hit > 0 ? HIT_BG : MISS_BG }}>
                  <Text style={{ width: 52, textAlign: 'right', paddingRight: 10, opacity: 0.55, fontFamily: MONO, fontSize: 12 }} className="text-foreground">
                    {r.n}
                  </Text>
                  <View style={{ width: 82, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, paddingRight: 10 }}>
                    {dots &&
                      r.hits &&
                      data.platforms.map((p, k) => <View key={p} accessibilityLabel={`${LABEL[p]} ${(r.hits?.[k] ?? 0) > 0 ? 'ran' : 'did not run'} this line`} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: (r.hits?.[k] ?? 0) > 0 ? PLATFORM[p] : 'rgba(128,128,128,0.3)' }} />)}
                    <Text style={{ fontFamily: MONO, fontSize: 11, color: r.hit === 0 ? HEALTH.bad : undefined, fontWeight: r.hit === 0 ? '600' : '400' }} className="text-muted-foreground">
                      {r.hit === null ? '' : r.hit > 0 ? `${fmt(r.hit)}×` : '0'}
                    </Text>
                  </View>
                  <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: r.hit === null ? 'transparent' : r.hit > 0 ? HEALTH.good : HEALTH.bad }} />
                  <Text style={{ fontFamily: MONO, fontSize: 12.5, paddingLeft: 10, paddingRight: 24, whiteSpace: 'pre' } as object}>
                    {r.tokens.length === 0 ? ' ' : r.tokens.map(([text, c], i) => (
                      <Text key={i} style={{ color: color(c) }}>
                        {text}
                      </Text>
                    ))}
                  </Text>
                </View>
              )}
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
}
