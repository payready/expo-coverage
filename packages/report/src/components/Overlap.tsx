import { useMemo } from 'react';
import { View } from 'react-native';
import { Card } from 'panelui-native/components/card';
import { Text } from 'panelui-native/primitives/text';
import { LABEL, fmt, overlap } from '../lib/stats';
import type { CoverageData } from '../lib/types';
import { HEALTH, OVERLAP, PLATFORM } from '../theme';

export function OverlapBar({ data }: { data: CoverageData }) {
  const o = useMemo(() => overlap(data), [data]);
  const n = data.platforms.length;
  if (n < 2) return null;
  const parts = [
    ...data.platforms.map((p) => ({ label: `Only ${LABEL[p]}`, count: o.only[p], color: PLATFORM[p] })),
    ...(n > 2 ? [{ label: 'Two platforms', count: o.some, color: OVERLAP.some }] : []),
    { label: n === 2 ? 'Both' : `All ${n}`, count: o.all, color: HEALTH.good },
    { label: 'Not covered', count: o.none, color: HEALTH.bad },
  ].filter((p) => p.count > 0);
  return (
    <Card className="mb-5 p-6">
      <Text className="text-base font-semibold text-foreground">Who covers each line</Text>
      <Text className="mb-4 text-muted-foreground">Every executable line, across every platform.</Text>
      <View className="mb-3 h-8 flex-row gap-0.5 overflow-hidden rounded-xl">
        {parts.map((p) => (
          <View key={p.label} style={{ flexGrow: p.count, minWidth: 3, backgroundColor: p.color }} />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
        {parts.map((p) => (
          <View key={p.label} className="flex-row items-center gap-1.5">
            <View className="size-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            <Text className="text-muted-foreground">{p.label}</Text>
            <Text className="font-semibold text-foreground">{fmt(p.count)}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
