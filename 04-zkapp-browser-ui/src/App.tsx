import React, { useEffect, useState } from 'react';
import logo from './logo.svg';
import './App.css';

import { Initialize, OnReady } from './Initialize';
import SmartContractUI from './SmartContractUI';

import { Square, snarkyjs } from '03-deploying-to-a-live-network';

const { Mina, Field, PublicKey, PrivateKey, isReady, fetchAccount, setGraphqlEndpoint } = snarkyjs;

let preLoadTime = Date.now();

let transactionFee = 100_000_000;

let mockEffects = true;

function App() {

  enum Stage {
    Initialize,
    Transition,
    SquareApp
  }

  let [state, setState] = useState({
    stage: Stage.Initialize,
    publicKey: null as InstanceType<typeof PublicKey> | null,
    privateKey: null as InstanceType<typeof PrivateKey> | null,
    zkapp: null as InstanceType<typeof Square> | null,
    initialState: null as InstanceType<typeof Field> | null,
  });

  let onInitialized: OnReady = (publicKey, privateKey, zkapp, initialState) => {
    setState({ ...state, stage: Stage.Transition, publicKey, privateKey, zkapp, initialState });
  }

  if (state.stage == Stage.Transition) {
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      setState({ ...state, stage: Stage.SquareApp });
    })();
  }

  if (state.stage == Stage.Initialize || state.stage == Stage.Transition) {
    return (<div className="App">
      <Initialize onReady={ onInitialized } mockEffects />
    </div>);
  } else {
    return (<div className="App">
      <SmartContractUI publicKey={state.publicKey!} privateKey={state.privateKey!} zkapp={state.zkapp!} initialState={state.initialState!} mockEffects={mockEffects} transactionFee={transactionFee}/>
    </div>);
  }

}

export default App;
