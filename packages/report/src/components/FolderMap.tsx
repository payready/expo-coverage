import { useMemo } from 'react';
import { Card } from 'panelui-native/components/card';
import { TreemapChart } from 'panelui-native/components/treemap-chart';
import { Text } from 'panelui-native/primitives/text';
import { areaOf, health, pct } from '../lib/stats';
import type { FileEntry, Tab } from '../lib/types';
import { HEALTH } from '../theme';

export function FolderMap({ files, tab, folder, onFolder }: { files: FileEntry[]; tab: Tab; folder: string | null; onFolder: (f: string | null) => void }) {
  const tiles = useMemo(() => {
    const groups = new Map<string, { covered: number; total: number }>();
    for (const f of files) {
      const l = f.sums[tab]?.l;
      if (!l) continue;
      const area = areaOf(f.p);
      const g = groups.get(area) ?? { covered: 0, total: 0 };
      g.covered += l[0];
      g.total += l[1];
      groups.set(area, g);
    }
    return [...groups.entries()]
      .filter(([, g]) => g.total > 0)
      .map(([name, g]) => ({ label: `${name}  ${pct([g.covered, g.total]).toFixed(0)}%`, value: g.total, color: HEALTH[health(pct([g.covered, g.total]))], name }))
      .sort((a, b) => b.value - a.value);
  }, [files, tab]);
  const active = folder ? tiles.findIndex((t) => t.name === folder) : -1;

  return (
    <Card className="flex-1 p-6" style={{ flexBasis: 520 }}>
      <Text className="text-base font-semibold text-foreground">Where the code is</Text>
      <Text className="mb-4 text-muted-foreground">Each tile is a folder: sized by lines of code, colored by coverage. Press one to filter the files below.</Text>
      <TreemapChart
        data={tiles}
        sort={false}
        aspectRatio={1.9}
        gap={3}
        activeIndex={active}
        onActiveIndexChange={(i: number) => onFolder(i >= 0 ? (tiles[i]?.name ?? null) : null)}
      >
        <TreemapChart.Tiles />
        <TreemapChart.Labels />
      </TreemapChart>
    </Card>
  );
}
