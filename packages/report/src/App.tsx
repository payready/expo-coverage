import { ScrollView, View } from 'react-native';
import { PanelUIProvider } from 'panelui-native/provider';
import { Kpi } from 'panelui-native/components/kpi';
import { RingChart } from 'panelui-native/components/ring-chart';
import { TreemapChart } from 'panelui-native/components/treemap-chart';

export function App() {
  return (
    <PanelUIProvider>
      <ScrollView className="flex-1 bg-background">
        <View className="gap-4 p-6">
          <Kpi>
            <Kpi.Header><Kpi.Title>Lines covered</Kpi.Title></Kpi.Header>
            <Kpi.Content><Kpi.Value>81.0%</Kpi.Value><Kpi.Trend value={1.2} /></Kpi.Content>
          </Kpi>
          <RingChart data={[{ label: 'iOS', value: 80, max: 100 }, { label: 'Android', value: 66, max: 100 }, { label: 'Web', value: 84, max: 100 }]}>
            <RingChart.Header title="Platforms" legend />
            <RingChart.Ring index={0} /><RingChart.Ring index={1} /><RingChart.Ring index={2} />
            <RingChart.Center />
          </RingChart>
          <TreemapChart data={[{ label: 'components', value: 2216 }, { label: 'hooks', value: 1357 }, { label: 'lib', value: 936 }]}>
            <TreemapChart.Header title="Folders" />
            <TreemapChart.Tiles /><TreemapChart.Labels />
          </TreemapChart>
        </View>
      </ScrollView>
    </PanelUIProvider>
  );
}
