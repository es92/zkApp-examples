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

import { BasicTokenContract } from './BasicTokenContract.js';
import { Mina, PrivateKey, AccountUpdate, UInt64, Signature } from 'snarkyjs';

console.log('SnarkyJS loaded');

const proofsEnabled = false;
const Local = Mina.LocalBlockchain({ proofsEnabled });
Mina.setActiveInstance(Local);
const deployerAccount = Local.testAccounts[0].privateKey;
// ----------------------------------------------------

const zkAppPrivateKey = PrivateKey.random();
const zkAppAddress = zkAppPrivateKey.toPublicKey();

console.log('compiling...');

await BasicTokenContract.compile();

console.log('compiled');

// ----------------------------------------------------

console.log('deploying...');
const zkAppInstance = new BasicTokenContract(zkAppAddress);

const deploy_txn = await Mina.transaction(deployerAccount.toPublicKey(), () => {
  AccountUpdate.fundNewAccount(deployerAccount.toPublicKey());
  zkAppInstance.deploy({});
});

console.log('prooving...');
await deploy_txn.prove();
console.log('signing...');
console.log('Deployer: ', deployerAccount.toPublicKey().toBase58());
console.log('Contract: ', zkAppAddress.toBase58());
await deploy_txn.sign([deployerAccount, zkAppPrivateKey]).send();

// ----------------------------------------------------

console.log('initializing...');

const init_txn = await Mina.transaction(deployerAccount.toPublicKey(), () => {
  zkAppInstance.init();
});

await init_txn.prove();
await init_txn.sign([deployerAccount]).send();

console.log('initialized');

// ----------------------------------------------------

console.log('minting...');

const mintAmount = UInt64.from(10);

const mintSignature = Signature.create(
  zkAppPrivateKey,
  mintAmount.toFields().concat(zkAppAddress.toFields())
);

const mint_txn = await Mina.transaction(deployerAccount.toPublicKey(), () => {
  AccountUpdate.fundNewAccount(deployerAccount.toPublicKey());
  zkAppInstance.mint(zkAppAddress, mintAmount, mintSignature);
});

await mint_txn.prove();
await mint_txn.sign([deployerAccount, zkAppPrivateKey]).send();

console.log('minted');

console.log(
  zkAppInstance.totalAmountInCirculation.get() +
    ' ' +
    Mina.getAccount(zkAppAddress).tokenSymbol
);

// ----------------------------------------------------

console.log('sending...');

const sendAmount = UInt64.from(3);

const send_txn = await Mina.transaction(deployerAccount.toPublicKey(), () => {
  AccountUpdate.fundNewAccount(deployerAccount.toPublicKey());
  zkAppInstance.sendTokens(
    zkAppAddress,
    deployerAccount.toPublicKey(),
    sendAmount
  );
});
await send_txn.prove();
await send_txn.sign([deployerAccount, zkAppPrivateKey]).send();

console.log('sent');

console.log(
  zkAppInstance.totalAmountInCirculation.get() +
    ' ' +
    Mina.getAccount(zkAppAddress).tokenSymbol
);

// ----------------------------------------------------

console.log(
  'deployer tokens:',
  Mina.getBalance(
    deployerAccount.toPublicKey(),
    zkAppInstance.token.id
  ).value.toBigInt()
);

console.log(
  'zkapp tokens:',
  Mina.getBalance(zkAppAddress, zkAppInstance.token.id).value.toBigInt()
);

// ----------------------------------------------------

console.log('Main08 Finished');
