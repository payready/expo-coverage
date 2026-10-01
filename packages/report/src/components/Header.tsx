import { Linking, Pressable, View } from 'react-native';
import { Chip } from 'panelui-native/components/chip';
import { Tabs } from 'panelui-native/components/tabs';
import { Text } from 'panelui-native/primitives/text';
import { LABEL, pct, totals, visibleFiles } from '../lib/stats';
import type { CoverageData, Tab } from '../lib/types';

export function Header({ data, tab, onTab }: { data: CoverageData; tab: Tab; onTab: (t: Tab) => void }) {
  const tabs: Tab[] = [...data.platforms, ...(data.platforms.length > 1 ? (['all'] as const) : [])];
  return (
    <View className="mb-6 flex-row flex-wrap items-end justify-between gap-4">
      <View style={{ maxWidth: '100%', flexShrink: 1 }}>
        <Text className="text-2xl font-bold text-foreground">{data.title}</Text>
        <Text className="mt-1 text-muted-foreground">
          {data.platforms.map((p) => LABEL[p]).join(' + ')} · generated {new Date(data.generated).toLocaleString()}
        </Text>
        <Meta data={data} />
      </View>
      <View style={{ minWidth: tabs.length * 132, maxWidth: '100%' }}>
      <Tabs value={tab} defaultValue={tab} onValueChange={(v) => onTab(v as Tab)}>
        <Tabs.List>
          {tabs.map((t) => (
            <Tabs.Trigger
              key={t}
              value={t}
              badge={
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {pct(totals(visibleFiles(data, t), t, 'l')).toFixed(1)}%
                </Text>
              }
            >
              {LABEL[t]}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>
      </View>
    </View>
  );
}

function Meta({ data }: { data: CoverageData }) {
  const app = data.meta?.app;
  const git = data.meta?.git;
  if (!app && !git) return null;
  const appBits = [app?.name, app?.version && `v${app.version}`, app?.expoSdk && `Expo ${app.expoSdk}`, app?.reactNative && `React Native ${app.reactNative}`].filter(Boolean);
  const ids = [app?.ios && `iOS ${app.ios}`, app?.android && `Android ${app.android}`].filter(Boolean);
  return (
    <View className="mt-3 gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        {appBits.length > 0 && <Text className="font-medium text-foreground">{appBits.join(' · ')}</Text>}
        {ids.length > 0 && <Text className="text-xs text-muted-foreground">{ids.join(' · ')}</Text>}
      </View>
      {git && (
        <View className="flex-row flex-wrap items-center gap-2" style={{ maxWidth: '100%' }}>
          <Pressable disabled={!git.url} onPress={() => git.url && void Linking.openURL(git.url)} accessibilityRole={git.url ? 'link' : undefined}>
            <Text className="font-mono text-sm text-foreground" style={git.url ? { textDecorationLine: 'underline' } : undefined}>
              {git.short}
            </Text>
          </Pressable>
          {git.branch && git.branch !== 'HEAD' && <Chip>{git.branch}</Chip>}
          {git.dirty && <Chip>uncommitted changes</Chip>}
          {git.subject && (
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {git.subject}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
