import { Pressable, View } from 'react-native';
import { Card } from 'panelui-native/components/card';
import { Text } from 'panelui-native/primitives/text';
import { fmt, missed } from '../lib/stats';
import type { FileEntry, Tab } from '../lib/types';
import { HEALTH } from '../theme';

export function Gaps({ files, tab, onOpen }: { files: FileEntry[]; tab: Tab; onOpen: (path: string) => void }) {
  const rows = files
    .map((f) => ({ f, miss: missed(f, tab) }))
    .filter((r) => r.miss > 0)
    .sort((a, b) => b.miss - a.miss)
    .slice(0, 8);
  return (
    <Card className="flex-1 p-6" style={{ flexBasis: 320 }}>
      <Text className="text-base font-semibold text-foreground">Biggest gaps</Text>
      <Text className="mb-3 text-muted-foreground">Files with the most lines nothing ran.</Text>
      {rows.length === 0 && <Text className="py-8 text-center text-muted-foreground">Nothing missed.</Text>}
      {rows.map(({ f, miss }) => (
        <Pressable key={f.p} onPress={() => onOpen(f.p)} className="flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-muted hover:bg-muted">
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-medium text-foreground">{f.p.split('/').pop()}</Text>
            <Text numberOfLines={1} className="text-xs text-muted-foreground">{f.p}</Text>
          </View>
          <View className="items-end">
            <Text className="font-semibold" style={{ color: HEALTH.bad }}>{fmt(miss)}</Text>
            <Text className="text-[11px] text-muted-foreground">lines missed</Text>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}
