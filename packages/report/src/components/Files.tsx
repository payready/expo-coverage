import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button } from 'panelui-native/components/button';
import { Card } from 'panelui-native/components/card';
import { Chip } from 'panelui-native/components/chip';
import { Progress } from 'panelui-native/components/progress';
import { Table } from 'panelui-native/components/table';
import { Text } from 'panelui-native/primitives/text';
import { LABEL, areaOf, fmt, health, missed, pct } from '../lib/stats';
import type { CoverageData, FileEntry, Tab } from '../lib/types';
import { PLATFORM, PROGRESS_COLOR } from '../theme';

type SortKey = 'file' | 'pct' | 'miss' | 'lines';
const PAGE = 50;

const sorters: Record<SortKey, (f: FileEntry, tab: Tab) => string | number> = {
  file: (f) => f.p,
  pct: (f, tab) => (f.sums[tab] ? pct(f.sums[tab].l) : 0),
  miss: (f, tab) => missed(f, tab),
  lines: (f, tab) => f.sums[tab]?.l[1] ?? 0,
};

interface Props {
  data: CoverageData;
  files: FileEntry[];
  tab: Tab;
  folder: string | null;
  onFolder: (f: string | null) => void;
  onOpen: (path: string) => void;
}

export function Files({ data, files, tab, folder, onFolder, onOpen }: Props) {
  const [q, setQ] = useState('');
  const [gapsOnly, setGapsOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'miss', dir: -1 });
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const get = sorters[sort.key];
    return files
      .filter((f) => (!needle || f.p.toLowerCase().includes(needle)) && (!folder || areaOf(f.p) === folder) && (!gapsOnly || missed(f, tab) > 0))
      .sort((a, b) => {
        const x = get(a, tab);
        const y = get(b, tab);
        return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
      });
  }, [files, tab, q, folder, gapsOnly, sort]);

  const showPlatforms = tab === 'all' && data.platforms.length > 1;
  const columns = [{ flex: 4 }, { flex: 3 }, { flex: 1, align: 'end' as const }, { flex: 1, align: 'end' as const }, ...(showPlatforms ? [{ flex: 1 }] : [])];
  const head = (key: SortKey, label: string) => (
    <Table.Head
      key={key}
      sortDirection={sort.key === key ? (sort.dir > 0 ? 'asc' : 'desc') : undefined}
      onPress={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : key === 'file' ? 1 : -1 }))}
    >
      {label}
    </Table.Head>
  );

  return (
    <Card className="p-6">
      <Text className="text-base font-semibold text-foreground">Files</Text>
      <Text className="mb-4 text-muted-foreground">
        {fmt(rows.length)} of {fmt(files.length)} files{folder ? ` in ${folder}` : ''}. Press a file to see line hits.
      </Text>
      <View className="mb-4 flex-row flex-wrap items-center gap-2.5">
        <TextInput
          value={q}
          onChangeText={(t) => {
            setQ(t);
            setLimit(PAGE);
          }}
          placeholder="Filter files"
          autoCapitalize="none"
          autoCorrect={false}
          className="min-w-[240px] flex-1 rounded-xl border border-border bg-muted px-3.5 py-2.5 text-foreground"
        />
        <Chip selected={gapsOnly} onPress={() => setGapsOnly((v) => !v)}>
          Only files with gaps
        </Chip>
        {folder && <Chip selected onClose={() => onFolder(null)}>{folder}</Chip>}
      </View>
      <Table columns={columns}>
        <Table.Header>
          <Table.Row>
            {head('file', 'File')}
            {head('pct', 'Covered')}
            {head('miss', 'Missed')}
            {head('lines', 'Lines')}
            {showPlatforms && <Table.Head>Platforms</Table.Head>}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.slice(0, limit).map((f) => {
            const sums = f.sums[tab];
            if (!sums) return null;
            const value = pct(sums.l);
            const slash = f.p.lastIndexOf('/');
            return (
              <Table.Row key={f.p} onPress={() => onOpen(f.p)}>
                <Table.Cell>
                  <Text className="font-medium text-foreground">{f.p.slice(slash + 1)}</Text>
                  <Text className="text-xs text-muted-foreground">{slash > 0 ? f.p.slice(0, slash) : ''}</Text>
                </Table.Cell>
                <Table.Cell>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1" style={{ minWidth: 40 }}>
                      <Progress value={value} color={PROGRESS_COLOR[health(value)]} />
                    </View>
                    <Text className="w-14 shrink-0 text-right text-foreground" numberOfLines={1}>{value.toFixed(0)}%</Text>
                  </View>
                </Table.Cell>
                <Table.Cell>{fmt(sums.l[1] - sums.l[0])}</Table.Cell>
                <Table.Cell>{fmt(sums.l[1])}</Table.Cell>
                {showPlatforms && (
                  <Table.Cell>
                    <View className="flex-row gap-1">
                      {data.platforms.map((p) => (
                        <View key={p} accessibilityLabel={LABEL[p]} className="size-2 rounded-full" style={{ backgroundColor: (f.sums[p]?.l[0] ?? 0) > 0 ? PLATFORM[p] : 'rgba(128,128,128,0.3)' }} />
                      ))}
                    </View>
                  </Table.Cell>
                )}
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
      {rows.length === 0 && <Text className="py-9 text-center text-muted-foreground">No files match.</Text>}
      {rows.length > limit && (
        <View className="mt-4 items-center">
          <Button variant="outline" onPress={() => setLimit((l) => l + PAGE)}>
            {`Show ${Math.min(PAGE, rows.length - limit)} more`}
          </Button>
        </View>
      )}
    </Card>
  );
}
