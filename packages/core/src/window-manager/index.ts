export type {
  OpenWindow,
  SystemWindowArgs,
  WindowBounds,
  WindowManagerAction,
  WindowManagerActions,
  WindowManagerDispatch,
  WindowManagerState,
  WindowPayload,
  WindowState,
} from "./types";
export { windowIdOf } from "./types";
export {
  initialWindowManagerState,
  windowManagerReducer,
} from "./reducer";
export {
  WindowManagerProvider,
  useWindowManager,
  type UseWindowManagerResult,
} from "./context";
