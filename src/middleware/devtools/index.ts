import { LOG } from "../../utils/common";
import {
  BaseStore,
  DevtoolsConfig,
  DevToolsMessage,
  DevtoolsState,
  DevtoolsStore,
  StoreState,
} from "../../utils/types";

export function devtoolsImpl<S extends BaseStore<any>>(
  store: S,
  config?: DevtoolsConfig
) {
  const devtoolsState: DevtoolsState<StoreState<S>> = {
    initialState: store.get(),
    currentState: store.get(),
    actionsHistory: [],
    pausedRecording: false,
  };

  const devToolsConnection =
    globalThis.window.__REDUX_DEVTOOLS_EXTENSION__.connect({
      name: config?.name ?? "",
      features: {
        pause: true,
        lock: true,
        persist: false,
        export: true,
        import: "custom",
        jump: true,
        skip: true,
        reorder: true,
        dispatch: true,
        ...(config?.features || {}),
      },
    });

  devToolsConnection.init({ value: devtoolsState.initialState });

  let skipNextUpdate = true;
  const unsubscribeFromDevTools = devToolsConnection.subscribe(
    (message: DevToolsMessage) => {
      if (message.type === "DISPATCH" && message.state) {
        switch (message.payload.type) {
          case "JUMP_TO_ACTION":
          case "JUMP_TO_STATE": {
            try {
              const { value } = JSON.parse(message.state);
              skipNextUpdate = true;
              store.set(value);
              devtoolsState.currentState = value;
            } catch (error) {
              LOG.error("[Devtool] Error parsing state:", error);
            }
            break;
          }

          case "PAUSE_RECORDING":
            devtoolsState.pausedRecording = message.payload.status;
            break;

          case "COMMIT":
            devtoolsState.initialState = devtoolsState.currentState;
            devtoolsState.actionsHistory = [];
            devToolsConnection.init({ value: devtoolsState.currentState });
            break;

          case "RESET":
            skipNextUpdate = true;
            store.set(devtoolsState.initialState);
            devtoolsState.currentState = devtoolsState.initialState;
            devtoolsState.actionsHistory = [];
            devToolsConnection.init({ value: devtoolsState.initialState });
            break;

          case "TOGGLE_ACTION":
            const actionId = message.payload.actionId;
            if (
              actionId >= 0 &&
              actionId < devtoolsState.actionsHistory.length
            ) {
              const action = devtoolsState.actionsHistory[actionId];
              action.skipped = !action.skipped;

              let computedState = devtoolsState.initialState;
              for (let i = 0; i < devtoolsState.actionsHistory.length; i++) {
                const historyItem = devtoolsState.actionsHistory[i];
                if (!historyItem.skipped) {
                  computedState = historyItem.state;
                }
              }

              skipNextUpdate = true;
              store.set(computedState);
              devtoolsState.currentState = computedState;
            }
            break;

          case "ROLLBACK":
            skipNextUpdate = true;
            store.set(devtoolsState.initialState);
            devtoolsState.currentState = devtoolsState.initialState;
            break;

          default:
            break;
        }
      }
    }
  );

  store.subscribe((state: StoreState<S>) => {
    if (skipNextUpdate) {
      skipNextUpdate = false;
      return;
    }

    if (!devtoolsState.pausedRecording) {
      devtoolsState.currentState = state;
      devtoolsState.actionsHistory.push({
        actionType: "@@state/change",
        state,
      });

      devToolsConnection.send("@@state/change", { value: state });
    }
  });

  function dispatch(actionType: string, payload?: any) {
    if (!devtoolsState.pausedRecording) {
      const currentState = store.get();

      devtoolsState.actionsHistory.push({
        actionType,
        state: currentState,
        payload,
      });

      devToolsConnection.send(actionType, {
        value: currentState,
        payload,
      });
    }
  }

  const __devtoolsUnsubscribe = () => {
    unsubscribeFromDevTools();
  };

  return {
    dispatch,
    __devtoolsUnsubscribe,
  };
}

/**
 * Enhances a store with Redux DevTools integration
 * @param store The base store to enhance
 * @param config Configuration options for DevTools
 * @returns Enhanced store with DevTools integration
 */
export function devtools<T, S extends BaseStore<T>>(
  store: S,
  config?: DevtoolsConfig
): DevtoolsStore<S> {
  const isEnabled = config?.enabled ?? process.env.NODE_ENV !== "production";

  const hasDevTools =
    typeof window !== "undefined" &&
    typeof window.__REDUX_DEVTOOLS_EXTENSION__ !== "undefined";

  const enhancedStore = Object.assign(store, {
    dispatch: () => {},
    __devtoolsUnsubscribe: () => {},
  }) as DevtoolsStore<S>;

  if (!isEnabled) {
    LOG.info("[Devtool] DevTools is disabled via config.");
    return enhancedStore;
  }

  if (!hasDevTools) {
    LOG.warn("[Devtool] Redux DevTools Extension is not available.");
    return enhancedStore;
  }

  let initialized = false;
  const originalGet = store.get;

  enhancedStore.get = () => {
    const state = originalGet.call(store);
    if (!initialized) {
      initialized = true;
      LOG.info("[Devtool] Initializing DevTools with config:", config);
      Object.assign(enhancedStore, devtoolsImpl(enhancedStore, config));
    }
    return state;
  };

  return enhancedStore;
}
