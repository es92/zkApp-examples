import '../styles/globals.css'
import React, { useEffect, useState } from "react";
import './reactCOIServiceWorker';

import ZkappWorkerClient from './zkappWorkerClient';

import {
  PublicKey,
  PrivateKey,
  Field,
} from 'snarkyjs'

let transactionFee = 100_000_000;

export default function App() {

  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasBeenSetup: false,
    accountExists: false,
    currentNum: null as null | Field,
    privateKey: null as null | PrivateKey,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
  });

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    (async () => {
      if (!state.hasBeenSetup) {
        const zkappWorkerClient = new ZkappWorkerClient();
        
        console.log('Loading SnarkyJS...');
        await zkappWorkerClient.loadSnarkyJS();
        console.log('done');

        await zkappWorkerClient.setActiveInstanceToBerkeley();

        if (localStorage.privateKey == null) {
          localStorage.privateKey = PrivateKey.random().toBase58();
        }

        let privateKey = PrivateKey.fromBase58(localStorage.privateKey);
        let publicKey = privateKey.toPublicKey();

        console.log('using key', publicKey.toBase58());

        console.log('checking if account exists...');
        const res = await zkappWorkerClient.fetchAccount({ publicKey: publicKey! });
        const accountExists = res.error == null;

        await zkappWorkerClient.loadContract();

        console.log('compiling zkApp');
        await zkappWorkerClient.compileContract();
        console.log('zkApp compiled');

        const zkappPublicKey = PublicKey.fromBase58('B62qph2VodgSo5NKn9gZta5BHNxppgZMDUihf1g7mXreL4uPJFXDGDA');

        await zkappWorkerClient.initZkappInstance(zkappPublicKey);

        console.log('getting zkApp state...');
        await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey })
        const currentNum = await zkappWorkerClient.getNum();
        console.log('current state:', currentNum.toString());

        setState({ 
            ...state, 
            zkappWorkerClient, 
            hasBeenSetup: true, 
            publicKey, 
            privateKey, 
            zkappPublicKey, 
            accountExists, 
            currentNum
        });
      }
    })();
  }, []);

  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (;;) {
          console.log('checking if account exists...');
          const res = await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! })
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, accountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);

  // -------------------------------------------------------
  // Send a transaction

  const onSendTransaction = async () => {
    setState({ ...state, creatingTransaction: true });
    console.log('sending a transaction...');

    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! });

    await state.zkappWorkerClient!.createUpdateTransaction(state.privateKey!, transactionFee);

    console.log('creating proof...');
    await state.zkappWorkerClient!.proveUpdateTransaction();

    const transactionHash = await state.zkappWorkerClient!.sendUpdateTransaction();

    console.log(
      'See transaction at https://berkeley.minaexplorer.com/transaction/' + transactionHash
    );

    setState({ ...state, creatingTransaction: false });
  }

  // -------------------------------------------------------
  // Refresh the current state

  const onRefreshCurrentNum = async () => {
    console.log('getting zkApp state...');
    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.zkappPublicKey! })
    const currentNum = await state.zkappWorkerClient!.getNum();
    console.log('current state:', currentNum.toString());

    setState({ ...state, currentNum });
  }

  // -------------------------------------------------------
  // Create UI elements

  let setupText = state.hasBeenSetup ? 'SnarkyJS Ready' : 'Setting up SnarkyJS...';
  let setup = <div> { setupText } </div>

  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink = "https://faucet.minaprotocol.com/?address=" + state.publicKey!.toBase58();
    accountDoesNotExist = <div>
      Account does not exist. Please visit the faucet to fund this account
      <a href={faucetLink} target="_blank" rel="noreferrer"> [Link] </a>
    </div>
  }

  let mainContent;
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = <div>
      <button onClick={onSendTransaction} disabled={state.creatingTransaction}> Send Transaction </button>
      <div> Current Number in zkApp: { state.currentNum!.toString() } </div>
      <button onClick={onRefreshCurrentNum}> Get Latest State </button>
    </div>
  }

  return <div>
   { setup }
   { accountDoesNotExist }
   { mainContent }
  </div>
}

