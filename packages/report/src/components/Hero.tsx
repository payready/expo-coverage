import { View } from 'react-native';
import { Card } from 'panelui-native/components/card';
import { Kpi } from 'panelui-native/components/kpi';
import { Progress } from 'panelui-native/components/progress';
import { RingChart } from 'panelui-native/components/ring-chart';
import { Text } from 'panelui-native/primitives/text';
import { fmt, health, pct, totals } from '../lib/stats';
import type { FileEntry, Tab } from '../lib/types';
import { HEALTH } from '../theme';

const KINDS = [
  ['Lines', 'l'],
  ['Statements', 's'],
  ['Functions', 'f'],
  ['Branches', 'b'],
] as const;

export function Hero({ files, tab }: { files: FileEntry[]; tab: Tab }) {
  const lines = totals(files, tab, 'l');
  const value = pct(lines);
  const never = files.filter((f) => f.sums[tab]?.l[0] === 0).length;
  return (
    <View className="mb-5 flex-row flex-wrap gap-5">
      <Card className="min-w-[280px] flex-1 items-center justify-center p-6" style={{ flexBasis: 300 }}>
        <RingChart
          data={[{ label: 'Lines covered', value: Number(value.toFixed(1)), maxValue: 100, color: HEALTH[health(value)] }]}
          size={190}
          strokeWidth={16}
        >
          <RingChart.Ring index={0} />
          <RingChart.Center />
        </RingChart>
        <Text className="mt-3 text-center text-muted-foreground">
          {fmt(lines[0])} of {fmt(lines[1])} lines{'\n'}
          {files.length} files, {never} never ran
        </Text>
      </Card>
      <View className="flex-1 flex-row flex-wrap gap-3" style={{ flexBasis: 480, alignContent: 'flex-start' }}>
        {KINDS.map(([label, key]) => {
          const ratio = totals(files, tab, key);
          const v = pct(ratio);
          return (
            <Card key={key} className="flex-1 gap-2 p-4" style={{ minWidth: 200 }}>
              <Kpi>
                <Kpi.Header>
                  <Kpi.Title>{label}</Kpi.Title>
                </Kpi.Header>
                <Kpi.Content>
                  <Kpi.Value>{v.toFixed(1)}%</Kpi.Value>
                </Kpi.Content>
              </Kpi>
              <Progress value={v} />
              <Text className="text-xs text-muted-foreground">
                {fmt(ratio[0])} / {fmt(ratio[1])}
              </Text>
            </Card>
          );
        })}
      </View>
    </View>
  );
}
