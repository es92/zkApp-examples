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

import { SignedMessageBoard } from './SignedMessageBoard.js';
import { OffChainStorage, MerkleWitness8 } from './lib/OffChainStorage.js';

import {
  Mina,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  Group,
  Character,
  CircuitString,
  Signature,
  Bool,
} from 'snarkyjs';

import XMLHttpRequestTs from 'xmlhttprequest-ts';
const NodeXMLHttpRequest =
  XMLHttpRequestTs.XMLHttpRequest as any as typeof XMLHttpRequest;

// ----------------------------------------

const transactionFee = 100_000_000;

const treeHeight = 8;

const Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);

const deployerKey = Local.testAccounts[0].privateKey;
const deployerAccount = deployerKey.toPublicKey();

const zkappPrivateKey = PrivateKey.random();
const zkAppAddress = zkappPrivateKey.toPublicKey();

// ----------------------------------------
// deploy and initialize the smart contract

const storageServerAddress = 'http://localhost:3001';
const serverPublicKey = await OffChainStorage.getPublicKey(
  storageServerAddress,
  NodeXMLHttpRequest
);

console.log('Compiling smart contract...');
await SignedMessageBoard.compile();

const zkapp = new SignedMessageBoard(zkAppAddress);

const deployTxn = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  zkapp.deploy({ zkappKey: zkappPrivateKey });
  zkapp.initState(serverPublicKey);
});
await deployTxn.prove();
await deployTxn.sign([deployerKey, zkappPrivateKey]).send();

// ----------------------------------------------------
// Perform serveral updates to the zkApp state

const idx = BigInt(7);
const messageStr = 'hi';

// Get the existing tree
const treeRoot = await zkapp.storageTreeRoot.get();
const idx2fields = await OffChainStorage.get(
  storageServerAddress,
  zkAppAddress,
  treeHeight,
  treeRoot,
  NodeXMLHttpRequest
);

const tree = OffChainStorage.mapToTree(treeHeight, idx2fields);
const leafWitness = new MerkleWitness8(tree.getWitness(BigInt(idx)));

// get the prior leaf
const priorLeafIsEmpty = !idx2fields.has(idx);
let priorLeafMessage = CircuitString.fromString('');
let priorLeafSigner = PrivateKey.random().toPublicKey();
if (!priorLeafIsEmpty) {
  const fields = idx2fields.get(idx)!;

  const publicKeyFields = fields.slice(0, 2);
  priorLeafSigner = PublicKey.fromGroup(
    new Group(publicKeyFields[0], publicKeyFields[1])
  );

  const messageFields = fields.slice(2);
  const messageChars = messageFields.map((f) => new Character(f));
  priorLeafMessage = CircuitString.fromCharacters(messageChars);
}

// Update the leaf
const message = CircuitString.fromString(messageStr);
const publicKey = deployerKey.toPublicKey();
const newLeaf = publicKey.toFields().concat(message.toFields());
idx2fields.set(idx, newLeaf);

// Sign the update with the public key we're using
const signature = Signature.create(deployerKey, newLeaf);

const [storedNewStorageNumber, storedNewStorageSignature] =
  await OffChainStorage.requestStore(
    storageServerAddress,
    zkAppAddress,
    treeHeight,
    idx2fields,
    NodeXMLHttpRequest
  );

// update the smart contract
const updateTransaction = await Mina.transaction(
  { sender: deployerAccount, fee: transactionFee },
  () => {
    zkapp!.update(
      priorLeafMessage,
      priorLeafSigner,
      Bool(priorLeafIsEmpty),
      leafWitness,
      message,
      publicKey,
      signature,
      storedNewStorageNumber,
      storedNewStorageSignature
    );
    zkapp.requireSignature();
  }
);

await updateTransaction.sign([deployerKey, zkappPrivateKey]).send();

console.log('root updated to', zkapp.storageTreeRoot.get().toString());

// ----------------------------------------------------

console.log('Main06b Message board Finished');
