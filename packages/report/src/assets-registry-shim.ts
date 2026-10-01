// react-native-web has no AssetRegistry; react-native-svg only needs these two to resolve image URIs.
const assets: unknown[] = [];
export const registerAsset = (asset: unknown): number => assets.push(asset);
export const getAssetByID = (id: number): unknown => assets[id - 1];
