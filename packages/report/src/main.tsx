import { AppRegistry } from 'react-native';
import './global.css';
import { App } from './App';
import type { CoverageData } from './lib/types';

declare global {
  interface Window {
    __COVERAGE__: CoverageData | null;
  }
}

async function load(): Promise<CoverageData> {
  if (window.__COVERAGE__) return window.__COVERAGE__;
  // `vite dev` has no injected data; put a real run in public/sample.json.
  return (await fetch('/sample.json')).json();
}

load().then((data) => {
  document.title = `${data.title}: e2e coverage`;
  AppRegistry.registerComponent('App', () => () => <App data={data} />);
  AppRegistry.runApplication('App', { rootTag: document.getElementById('root') as never });
});
