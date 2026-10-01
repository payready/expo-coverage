import { View } from 'react-native';
import { Tabs } from 'panelui-native/components/tabs';
import { Text } from 'panelui-native/primitives/text';
import { LABEL, pct, totals, visibleFiles } from '../lib/stats';
import type { CoverageData, Tab } from '../lib/types';

export function Header({ data, tab, onTab }: { data: CoverageData; tab: Tab; onTab: (t: Tab) => void }) {
  const tabs: Tab[] = [...data.platforms, ...(data.platforms.length > 1 ? (['all'] as const) : [])];
  return (
    <View className="mb-6 flex-row flex-wrap items-end justify-between gap-4">
      <View>
        <Text className="text-2xl font-bold text-foreground">{data.title}</Text>
        <Text className="mt-1 text-muted-foreground">
          {data.platforms.map((p) => LABEL[p]).join(' + ')} · generated {new Date(data.generated).toLocaleString()}
        </Text>
      </View>
      <Tabs value={tab} defaultValue={tab} onValueChange={(v) => onTab(v as Tab)}>
        <Tabs.List>
          {tabs.map((t) => (
            <Tabs.Trigger key={t} value={t}>
              {`${LABEL[t]}  ${pct(totals(visibleFiles(data, t), t, 'l')).toFixed(1)}%`}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
    </View>
  );
}
