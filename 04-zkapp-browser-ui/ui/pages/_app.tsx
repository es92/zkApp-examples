import '../styles/globals.css'
import React, { useEffect, useState } from "react";

import {
  Mina,
  isReady,
  PublicKey,
  PrivateKey,
  Field,
  fetchAccount,
} from 'snarkyjs'

import type { Add } from '../../contracts/src/Add';

let transactionFee = 100_000_000;

export default function App() {

  let [state, setState] = useState({
    hasBeenSetup: false,
    accountExists: false,
    currentNum: null as null | Field,
    privateKey: null as null | PrivateKey,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    zkapp: null as null | Add,
    transactionHash: '',
  });

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    (async () => {
      if (!state.hasBeenSetup) {
        console.log('Loading SnarkyJS...');
        await isReady;

        const Berkeley = Mina.BerkeleyQANet(
          "https://proxy.berkeley.minaexplorer.com/graphql"
        );
        Mina.setActiveInstance(Berkeley);

        if (localStorage.privateKey == null) {
          localStorage.privateKey = PrivateKey.random().toBase58();
        }

        let privateKey = PrivateKey.fromBase58(localStorage.privateKey);
        let publicKey = privateKey.toPublicKey();

        console.log('using key', publicKey.toBase58());

        const { Add } = await import('../../contracts/build/src/Add.js');
        console.log('compiling zkApp');
        await Add.compile();
        console.log('zkApp compiled');

        console.log('checking if account exists...');
        const res = await fetchAccount({ publicKey: publicKey! })
        const accountExists = res.error == null;

        const zkappPublicKey = PublicKey.fromBase58('B62qrBBEARoG78KLD1bmYZeEirUfpNXoMPYQboTwqmGLtfqAGLXdWpU');

        const zkapp = new Add(zkappPublicKey);

        console.log('getting zkApp state...');
        await fetchAccount({ publicKey: zkappPublicKey })
        const currentNum = await zkapp.num.get();
        console.log('current state:', currentNum.toString());

        setState({ ...state, hasBeenSetup: true, publicKey, privateKey, zkappPublicKey, accountExists, zkapp, currentNum });
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
          const res = await fetchAccount({ publicKey: state.publicKey! })
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
    console.log('sending a transaction...');

    await fetchAccount({ publicKey: state.publicKey! })

    const transaction = await Mina.transaction(
      { feePayerKey: state.privateKey!, fee: transactionFee },
      () => {
        state.zkapp!.update();
      }
    );

    console.log('creating proof...');
    await transaction!.prove();

    var txn_res = await transaction!.send();
    const transactionHash = await txn_res!.hash();

    console.log(
      'See transaction at https://berkeley.minaexplorer.com/transaction/' + transactionHash
    );

    setState({ ...state, transactionHash });
  }

  // -------------------------------------------------------
  // Refresh the current state

  const onRefreshCurrentNum = async () => {
    console.log('getting zkApp state...');
    await fetchAccount({ publicKey: state.zkappPublicKey! })
    const currentNum = await state.zkapp!.num.get();
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
      <button onClick={onSendTransaction}> Send Transaction </button>
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

