// https://github.com/rhvall/MinaDevContainer
// Based on code from https://github.com/o1-labs/docs2
// May 2023
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { NumberTreeContract } from './NumberTreeContract.js';
import { OffChainStorage, MerkleWitness8 } from './lib/OffChainStorage.js';
import fs from 'fs';

import { Mina, PrivateKey, AccountUpdate, Field, Bool } from 'snarkyjs';

import { makeAndSendTransaction, loopUntilAccountExists } from './utils.js';

import XMLHttpRequestTs from 'xmlhttprequest-ts';
const NodeXMLHttpRequest =
  XMLHttpRequestTs.XMLHttpRequest as any as typeof XMLHttpRequest;

const useLocal = true;

// ----------------------------------------------------
// Load a local or berkeley instance of the Mina blockchain
const transactionFee = 100_000_000;

const treeHeight = 8;

let deployerKey: PrivateKey;
let zkAppPrivateKey: PrivateKey;
if (useLocal) {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  deployerKey = Local.testAccounts[0].privateKey;
  zkAppPrivateKey = PrivateKey.random();
} else {
  const Berkeley = Mina.Network(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  const deployAlias = process.argv[2];

  const deployerKeysFileContents = fs.readFileSync(
    'keys/' + deployAlias + '.json',
    'utf8'
  );

  const deployerPrivateKeyBase58 = JSON.parse(
    deployerKeysFileContents
  ).privateKey;

  deployerKey = PrivateKey.fromBase58(deployerPrivateKeyBase58);
  zkAppPrivateKey = deployerKey;
}

const deployerAccount = deployerKey.toPublicKey();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

console.log('Using deployer account: ', deployerAccount.toBase58());
console.log('Using zkApp account: ', zkAppAddress.toBase58());

// ----------------------------------------
// Stablish connection to the OffChainStorage
const storageServerAddress = 'http://localhost:3001';
const serverPublicKey = await OffChainStorage.getPublicKey(
  storageServerAddress,
  NodeXMLHttpRequest
);

// ----------------------------------------------------
// Create an instance of NumberTreeContract zkApp contract - and deploy it to zkAppAddress
console.log('Compiling smart contract...');
await NumberTreeContract.compile();

const zkapp = new NumberTreeContract(zkAppAddress);

if (useLocal) {
  const transaction = await Mina.transaction(deployerKey.toPublicKey(), () => {
    AccountUpdate.fundNewAccount(deployerKey.toPublicKey());
    zkapp.deploy({ zkappKey: zkAppPrivateKey });
    zkapp.initState(serverPublicKey);
  });
  transaction.sign([zkAppPrivateKey, deployerKey]);
  await transaction.prove();
  await transaction.send();
} else {
  let zkAppAccount = await loopUntilAccountExists({
    account: zkAppPrivateKey.toPublicKey(),
    eachTimeNotExist: () =>
      console.log('waiting for zkApp account to be deployed...'),
    isZkAppAccount: true,
  });
}

// ----------------------------------------------------
// Perform serveral updates to the zkApp state
const height = 8;

async function updateTree() {
  const index = BigInt(Math.floor(Math.random() * 4));

  // get the existing tree
  const treeRoot = await zkapp.storageTreeRoot.get();
  const idx2fields = await OffChainStorage.get(
    storageServerAddress,
    zkAppAddress,
    treeHeight,
    treeRoot,
    NodeXMLHttpRequest
  );

  const tree = OffChainStorage.mapToTree(treeHeight, idx2fields);
  const leafWitness = new MerkleWitness8(tree.getWitness(BigInt(index)));

  // get the prior leaf
  const priorLeafIsEmpty = !idx2fields.has(index);
  let priorLeafNumber: Field;
  let newLeafNumber: Field;
  if (!priorLeafIsEmpty) {
    priorLeafNumber = idx2fields.get(index)![0];
    newLeafNumber = priorLeafNumber.add(3);
  } else {
    priorLeafNumber = Field.zero;
    newLeafNumber = Field.one;
  }

  // update the leaf, and save it in the storage server
  idx2fields.set(index, [newLeafNumber]);

  const [storedNewStorageNumber, storedNewStorageSignature] =
    await OffChainStorage.requestStore(
      storageServerAddress,
      zkAppAddress,
      treeHeight,
      idx2fields,
      NodeXMLHttpRequest
    );

  console.log(
    'changing index',
    index,
    'from',
    priorLeafNumber.toString(),
    'to',
    newLeafNumber.toString()
  );

  // update the smart contract

  const doUpdate = () => {
    zkapp.update(
      Bool(priorLeafIsEmpty),
      priorLeafNumber,
      newLeafNumber,
      leafWitness,
      storedNewStorageNumber,
      storedNewStorageSignature
    );
  };

  if (useLocal) {
    const updateTransaction = await Mina.transaction(
      { sender: deployerKey.toPublicKey(), fee: transactionFee },
      () => {
        doUpdate();
      }
    );

    updateTransaction.sign([zkAppPrivateKey, deployerKey]);
    await updateTransaction.prove();
    await updateTransaction.send();
  } else {
    await makeAndSendTransaction({
      feePayerPrivateKey: deployerKey,
      zkAppPublicKey: zkAppAddress,
      mutateZkApp: () => doUpdate(),
      transactionFee: transactionFee,
      getState: () => zkapp.storageTreeRoot.get(),
      statesEqual: (root1, root2) => root1.equals(root2).toBoolean(),
    });
  }

  console.log('root updated to', zkapp.storageTreeRoot.get().toString());
}

for (let i = 0; i < 3; i++) {
  await updateTree();
}

// ----------------------------------------------------

console.log('Main06 Finished');
