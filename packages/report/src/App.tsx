import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PanelUIProvider } from 'panelui-native/provider';
import { Text } from 'panelui-native/primitives/text';
import { Files } from './components/Files';
import { FolderMap } from './components/FolderMap';
import { Gaps } from './components/Gaps';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { OverlapBar } from './components/Overlap';
import { Source } from './components/Source';
import { visibleFiles } from './lib/stats';
import type { CoverageData, Tab } from './lib/types';

export function App({ data }: { data: CoverageData }) {
  const [tab, setTab] = useState<Tab>(data.platforms.length > 1 ? 'all' : (data.platforms[0] ?? 'all'));
  const [folder, setFolder] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const files = useMemo(() => visibleFiles(data, tab), [data, tab]);

  return (
    <PanelUIProvider>
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ alignItems: 'center' }}>
        <View className="w-full p-6 pb-20" style={{ maxWidth: 1240 }}>
          <Header data={data} tab={tab} onTab={(t) => { setTab(t); setFolder(null); }} />
          <Hero files={files} tab={tab} />
          <OverlapBar data={data} />
          <View className="mb-5 flex-row flex-wrap gap-5">
            <FolderMap files={files} tab={tab} folder={folder} onFolder={setFolder} />
            <Gaps files={files} tab={tab} onOpen={setOpen} />
          </View>
          <Files data={data} files={files} tab={tab} folder={folder} onFolder={setFolder} onOpen={setOpen} />
          <Text className="mt-8 text-center text-xs text-muted-foreground">
            {data.files.length} files instrumented · files the app never loaded are not counted
          </Text>
        </View>
      </ScrollView>
      {open && <Source data={data} path={open} tab={tab} onClose={() => setOpen(null)} />}
    </PanelUIProvider>
  );
}
