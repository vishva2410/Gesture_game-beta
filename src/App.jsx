import React, { Suspense } from 'react';
import HandController from './components/HandController';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import KeyboardController from './components/KeyboardController';


function App() {
  return (
    <>
      <HandController />
      <KeyboardController />
      <GameScene />
      <UIOverlay />
      <div style={{
        position: 'absolute', bottom: 5, left: 5, color: '#444', fontSize: '10px', pointerEvents: 'none'
      }}>
        Antigravity Agentic Build v1.0
      </div>
    </>
  );
}

export default App;
