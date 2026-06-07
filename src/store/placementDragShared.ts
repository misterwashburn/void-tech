import { makeMutable } from 'react-native-reanimated';

export const placementDragShared = {
  isActive: makeMutable(false),
  absoluteX: makeMutable(0),
  absoluteY: makeMutable(0),
  size: makeMutable(64),
};
