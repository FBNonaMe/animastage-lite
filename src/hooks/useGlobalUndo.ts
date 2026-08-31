import { useCallback, useRef } from 'react';
import type { AppState } from '../types';
import { createUndoStack } from '../editor/undoRedo';
import {
  applyEditorSnapshot,
  captureEditorSnapshot,
  type EditorUndoSnapshot,
} from '../editor/globalUndo';

export function useGlobalUndo() {
  const stack = useRef(createUndoStack<EditorUndoSnapshot>(100));

  const record = useCallback((appState: AppState) => {
    stack.current.push(captureEditorSnapshot(appState));
  }, []);

  const undo = useCallback((current: AppState): AppState | null => {
    const snap = stack.current.undo(captureEditorSnapshot(current));
    if (!snap) return null;
    return applyEditorSnapshot(current, snap);
  }, []);

  const redo = useCallback((current: AppState): AppState | null => {
    const snap = stack.current.redo(captureEditorSnapshot(current));
    if (!snap) return null;
    return applyEditorSnapshot(current, snap);
  }, []);

  const clear = useCallback(() => {
    stack.current.clear();
  }, []);

  return {
    record,
    undo,
    redo,
    clear,
    canUndo: () => stack.current.canUndo(),
    canRedo: () => stack.current.canRedo(),
  };
}
