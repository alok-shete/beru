import { useSyncExternalStore, useRef, useEffect, useMemo } from "react";

const objectIs =
  Object.is ||
  ((x: unknown, y: unknown) =>
    (x === y && (x !== 0 || 1 / (x as number) === 1 / (y as number))) ||
    (x !== x && y !== y));

function useSyncExternalStoreWithSelector<T, S>(
  subscribe: (cb: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot: (() => T) | undefined,
  selector: (snapshot: T) => S,
  isEqual?: (a: S, b: S) => boolean
): S {
  const instRef = useRef<{ hasValue: boolean; value: S | null }>({
    hasValue: false,
    value: null,
  });
  const inst = instRef.current;

  const [getMemoized, getServerMemoized] = useMemo(() => {
    let hasMemo = false,
      memoSnapshot: T,
      memoSelection: S;

    const memoSelector = (snapshot: T): S => {
      if (!hasMemo) {
        hasMemo = true;
        memoSnapshot = snapshot;
        const selection = selector(snapshot);
        if (isEqual && inst.hasValue && isEqual(inst.value as S, selection)) {
          return (memoSelection = inst.value as S);
        }
        return (memoSelection = selection);
      }

      if (objectIs(memoSnapshot, snapshot)) return memoSelection;

      const selection = selector(snapshot);
      if (isEqual && isEqual(memoSelection, selection)) {
        memoSnapshot = snapshot;
        return memoSelection;
      }

      memoSnapshot = snapshot;
      return (memoSelection = selection);
    };

    return [
      () => memoSelector(getSnapshot()),
      getServerSnapshot ? () => memoSelector(getServerSnapshot()) : undefined,
    ] as const;
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, getMemoized, getServerMemoized);

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);

  return value;
}

export { useSyncExternalStoreWithSelector };
