import React, { useEffect } from 'react';
import logo from './logo.svg';
import './App.css';

import { Square, snarkyjs } from '03-deploying-to-a-live-network';

const { Mina, PublicKey, PrivateKey, isReady, fetchAccount, setGraphqlEndpoint } = snarkyjs;

var ran_snarky = false;

function App() {

  async function snarky() {
    if (ran_snarky)
      return;
    ran_snarky = true;
    await isReady;

    const Berkeley = Mina.BerkeleyQANet(
      'https://proxy.berkeley.minaexplorer.com/graphql'
    );
    Mina.setActiveInstance(Berkeley);
    //setGraphqlEndpoint('https://proxy.berkeley.minaexplorer.com/graphql');

    if (localStorage.privateKey == null) {
      let privateKey = PrivateKey.random();
      localStorage.privateKey = privateKey.toBase58();

    }
    let privateKey = PrivateKey.fromBase58(localStorage.privateKey!);
    let publicKey = privateKey.toPublicKey()

    console.log('publicKey:', publicKey.toBase58());
    console.log('request faucet:', 'https://faucet.minaprotocol.com/?address=' + publicKey.toBase58());

    var hasFunds = false;
    //while (!hasFunds) {
    //  console.log('checking if account has funds...');
    //  let response = await fetchAccount({ publicKey: publicKey });
    //  if (response.error) {
    //    console.log(response.error.statusText);
    //    hasFunds = false;
    //  } else {
    //    hasFunds = true;
    //  }
    //  await new Promise(resolve => setTimeout(resolve, 5000))
    //}

    console.log('public key has funds and is ready for use');

    var zkAppAddress = PublicKey.fromBase58('B62qqonbhsDQrrutNK2faMXpGmJ9mtrxXRtkL5fRqbmoPnHuTJd83C8');

    console.log('Compiling smart contract...');
    //let { verificationKey } = await Square.compile(); // TODO useEffect
    console.log('smart contract compiled!');

    let zkapp = new Square(zkAppAddress);

    var res = await fetchAccount({ publicKey: zkAppAddress });
    console.log(await zkapp.num.get());
    var x = res!.account!.appState![0]!;
    console.log(x.toString());

    let transactionFee = 100_000_000;

    const xBefore = x;
    console.log('Found deployed zkapp, updating state', x!.toString(), '->', x!.mul(x!).toString());
    let transaction = await Mina.transaction(
      { feePayerKey: privateKey , fee: transactionFee },
      () => {
        zkapp.update(x!.mul(x!));
      }
    );

    // fill in the proof - this can take a while...
    console.log('Creating an execution proof...');
    const time0 = Date.now();
    await transaction.prove();
    const time1 = Date.now();
    console.log('creating proof took', (time1 - time0)/1e3, 'seconds')

    // if you want to inspect the transaction, you can print it out:
    // console.log(transaction.toGraphqlQuery());

    console.log('Sending the transaction...');
    var txn_res = await transaction.send();
    const hash = await txn_res.hash(); // This will change in a future version of SnarkyJS
    if (hash == null) {
      console.log('error sending transaction (see above)');
    } else {
      console.log('See transaction at', 'https://berkeley.minaexplorer.com/transaction/' + hash);
    }

    let stateChange = false;

    while (!stateChange) {
      console.log('waiting for zkApp state to change... (current state: ', x!.toString() + ')')
      await new Promise(resolve => setTimeout(resolve, 5000))
      var res = await fetchAccount({ publicKey: zkAppAddress });
      var x = res!.account!.appState![0]!;
      stateChange = (x != null && x.equals(xBefore).not().toBoolean());
    }
    console.log('updated state!', x!.toString());


    //let x = await zkapp.num.get();
    //let isDeployed = (x! != null && x!.equals(0).not().toBoolean()); // This will change in a future version of SnarkyJS
    //console.log(isDeployed, x!.toString());
  }

  snarky();


  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
