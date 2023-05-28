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

import { exit } from 'process';
import { users, MessageBoard } from './message.js';
import { Field, AccountUpdate, PrivateKey, Mina } from 'snarkyjs';

let useProof = false;
console.log('SnarkyJS loaded');

console.log('compiling...');

try {
  const { verificationKey } = await MessageBoard.compile();
} catch (err) {
  console.log('Error during compilation: ', err);
  exit(1);
}

const Local = Mina.LocalBlockchain({ proofsEnabled: useProof });
Mina.setActiveInstance(Local);
const { privateKey: deployerKey, publicKey: deployerAccount } =
  Local.testAccounts[0];

console.log('Initializing MessageBoard');

const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

const zkAppInstance = new MessageBoard(zkAppAddress);

let tx1 = await Mina.transaction(deployerAccount, () => {
  AccountUpdate.fundNewAccount(deployerAccount);
  // NOTE: this calls `init()` if this is the first deploy
  zkAppInstance.deploy({});
});

await tx1.prove();
await tx1.sign([deployerKey, zkAppPrivateKey]).send();

console.log(
  'MessageBoard init stored message:',
  zkAppInstance.message.get().toString()
);
console.log(
  'MessageBoard message hash:',
  zkAppInstance.messageHistoryHash.get().toString()
);

let tx2 = await Mina.transaction(deployerAccount, () => {
  zkAppInstance.publishMessage(Field(4), users.Bob);
});

await tx2.prove();
await tx2.sign([deployerKey, zkAppPrivateKey]).send();

console.log(
  'MessageBoard Bob stored message:',
  zkAppInstance.message.get().toString()
);
console.log(
  'MessageBoard message hash:',
  zkAppInstance.messageHistoryHash.get().toString()
);

// ----------------------------------------------------

console.log('Main10 Finished');
