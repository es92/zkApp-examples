import React, { useEffect, useState, ReactElement,  } from 'react';

import { Stage, createUseMakeStage, createGetStageComponent } from './utils'

import { Add, snarkyjs } from '04-zkapp-browser-ui-smart-contract';

const { Mina, Field, PublicKey, PrivateKey, isReady, fetchAccount, setGraphqlEndpoint } = snarkyjs;

function SmartContractUI({ publicKey, privateKey, zkapp, initialState, mockEffects, transactionFee }: {
  publicKey: InstanceType<typeof PublicKey>, 
  privateKey: InstanceType<typeof PrivateKey>, 
  zkapp: InstanceType<typeof Add>, 
  initialState: InstanceType<typeof Field>,
  mockEffects: boolean,
  transactionFee: number,
}) {

  let [state, setState] = useState({
    stages: {
      startUpdate: { stage: Stage.NotStarted, time: null } as { stage: Stage, time: null | number },
      makeTransaction: { stage: Stage.NotStarted, time: null } as { stage: Stage, time: null | number },
      proveTransaction: { stage: Stage.NotStarted, time: null } as { stage: Stage, time: null | number },
      sendTransaction: { stage: Stage.NotStarted, time: null } as { stage: Stage, time: null | number },
      waitStateChange: { stage: Stage.NotStarted, time: null } as { stage: Stage, time: null | number },
    },
    currentValue: initialState,
    transaction: null, // TODO fix this type
    transactionHash: "",
  });

  const useMakeStage = createUseMakeStage(state, setState)
  const getStageComponent = createGetStageComponent(state);

  // --------------------------------------------------------------------

  useMakeStage('startUpdate', 'makeTransaction', async (state) => {
    const num = state.currentValue;
    const numBefore = num;
    const updatedValue = num!.add(1);
    let transaction;
    if (mockEffects) {
      transaction = {
        prove: () => null
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    } else {
      transaction = await Mina.transaction(
        { feePayerKey: privateKey , fee: transactionFee },
        () => {
          zkapp.update(updatedValue);
        });
    }
    state.transaction = transaction;
    return state;
  });

  // --------------------------------------------------------------------

  useMakeStage('makeTransaction', 'proveTransaction', async (state) => {
    // to give UI a chance to refresh
    await new Promise(resolve => setTimeout(resolve, 500));
    await state.transaction.prove()
    return state;
  });

  // --------------------------------------------------------------------
  
  useMakeStage('proveTransaction', 'sendTransaction', async (state) => {
    let transaction = state.transaction;
    var txn_res = mockEffects ? null : await transaction.send();
    const hash = mockEffects ? "mock_hash" : await txn_res.hash(); // This will change in a future version of SnarkyJS
    state.transactionHash = hash;
    return state;
  });

  // --------------------------------------------------------------------

  useMakeStage('sendTransaction', 'waitStateChange', async (state) => {
    let stateChange = false;

    let num = state.currentValue;
    let numBefore = state.currentValue;

    while (!stateChange) {
      console.log('waiting for zkApp state to change... (current state: ', num!.toString() + ')')
      num = mockEffects ? num.add(1) : (await zkapp.num.fetch())!;
      stateChange = num!.equals(numBefore!).not().toBoolean();
      if (!stateChange)
        await new Promise(resolve => setTimeout(resolve, 5000))
    }

    state.currentValue = num;
    state.stages.startUpdate.stage = Stage.NotStarted;
    return state;
  });

  // --------------------------------------------------------------------

  let updateState = () => {
    state = { ...state }
    state.stages.startUpdate.stage = Stage.Done;
    state.stages.makeTransaction.stage = Stage.NotStarted;
    state.stages.proveTransaction.stage = Stage.NotStarted;
    state.stages.sendTransaction.stage = Stage.NotStarted;
    state.stages.waitStateChange.stage = Stage.NotStarted;

    setState(state);
  }

  let makeTransaction = getStageComponent(
                          'makeTransaction',
                          'Making transaction',
                          () => null);

  let proveTransaction = getStageComponent(
                          'proveTransaction',
                          'Proving transaction',
                          () => null);

  let sendTransaction = getStageComponent(
                          'sendTransaction',
                          'Sending transaction',
                          () => {
                            var href = 'https://berkeley.minaexplorer.com/transaction/' + state.transactionHash;
                            var transactionLink = <a href={href}  
                                                     target="_blank" 
                                                     rel="noreferrer">[Transaction link]</a>;
                            return <div> See transaction at { transactionLink }</div>
                          });

  let waitStateChange = getStageComponent(
                          'waitStateChange',
                          'Waiting for state to change',
                          () => <div> update complete. </div>);

  return <div>
   <div className="app">
     <div> Current State: { state.currentValue.toString() } </div> 
     <button onClick={ updateState } disabled={state.stages.startUpdate.stage == Stage.Done}> Update State (add 1) </button>
   </div>
   <div className="console">
      <div>click "Update State" to update the smart contract </div>
     { makeTransaction }
     { proveTransaction }
     { sendTransaction }
     { waitStateChange }
   </div>
  </div>
}

export default SmartContractUI;
