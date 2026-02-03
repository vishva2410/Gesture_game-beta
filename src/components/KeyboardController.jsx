import { useEffect, useRef } from 'react';
import { useGameStore } from '../store';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const KeyboardController = () => {
  const rafRef = useRef(null);
  const lastTimeRef = useRef(performance.now());
  const keysRef = useRef({
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
  });
  const usingKeyboardRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat) return;
      const code = event.code;
      if (code === 'ArrowLeft' || code === 'KeyA') keysRef.current.left = true;
      if (code === 'ArrowRight' || code === 'KeyD') keysRef.current.right = true;
      if (code === 'ArrowUp' || code === 'KeyW') keysRef.current.up = true;
      if (code === 'ArrowDown' || code === 'KeyS') keysRef.current.down = true;
      if (code === 'KeyF' || code === 'KeyJ') keysRef.current.fire = true;
    };

    const onKeyUp = (event) => {
      const code = event.code;
      if (code === 'ArrowLeft' || code === 'KeyA') keysRef.current.left = false;
      if (code === 'ArrowRight' || code === 'KeyD') keysRef.current.right = false;
      if (code === 'ArrowUp' || code === 'KeyW') keysRef.current.up = false;
      if (code === 'ArrowDown' || code === 'KeyS') keysRef.current.down = false;
      if (code === 'KeyF' || code === 'KeyJ') keysRef.current.fire = false;
    };

    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target && typeof target.closest === 'function' && target.closest('button')) return;
      keysRef.current.fire = true;
    };

    const onMouseUp = () => {
      keysRef.current.fire = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    const loop = (time) => {
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      const state = useGameStore.getState();
      const useKeyboard =
        state.controlMode === 'keyboard' ||
        (state.controlMode === 'auto' && !state.isHandDetected);

      const keyboardActive = useKeyboard && state.phase === 'playing';
      if (state.keyboardActive !== keyboardActive) {
        state.setKeyboardActive(keyboardActive);
      }

      if (keyboardActive) {
        usingKeyboardRef.current = true;

        const speed = 1.8;
        const dirX = (keysRef.current.left ? -1 : 0) + (keysRef.current.right ? 1 : 0);
        const dirY = (keysRef.current.down ? -1 : 0) + (keysRef.current.up ? 1 : 0);

        if (dirX !== 0 || dirY !== 0) {
          const magnitude = Math.hypot(dirX, dirY) || 1;
          const nextX = clamp(
            state.handPosition.x + (dirX / magnitude) * speed * delta,
            -1,
            1
          );
          const nextY = clamp(
            state.handPosition.y + (dirY / magnitude) * speed * delta,
            -1,
            1
          );
          state.setHandPosition(nextX, nextY, 0);
        }

        if (keysRef.current.fire) {
          if (state.gesture !== 'fist') {
            state.setGesture('fist');
            state.setGestureConfidence(1);
          }
        } else if (state.gesture === 'fist') {
          state.setGesture('none');
          state.setGestureConfidence(0);
        }
      } else if (usingKeyboardRef.current) {
        usingKeyboardRef.current = false;
        if (state.gesture === 'fist') {
          state.setGesture('none');
          state.setGestureConfidence(0);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return null;
};

export default KeyboardController;
