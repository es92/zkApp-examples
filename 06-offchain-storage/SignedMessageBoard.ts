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

import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  MerkleTree,
  CircuitString,
  PublicKey,
  Signature,
  Bool,
} from 'snarkyjs';

import {
  OffChainStorage,
  Update,
  MerkleWitness8,
} from './lib/OffChainStorage.js';

export class SignedMessageBoard extends SmartContract {
  @state(PublicKey) storageServerPublicKey = State<PublicKey>();
  @state(Field) storageNumber = State<Field>();
  @state(Field) storageTreeRoot = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method initState(storageServerPublicKey: PublicKey) {
    this.storageServerPublicKey.set(storageServerPublicKey);
    this.storageNumber.set(Field.zero);

    const emptyTreeRoot = new MerkleTree(8).getRoot();
    this.storageTreeRoot.set(emptyTreeRoot);
  }

  @method update(
    priorLeafMessage: CircuitString,
    priorLeafSigner: PublicKey,
    priorLeafIsEmpty: Bool,
    leafWitness: MerkleWitness8,
    message: CircuitString,
    publicKey: PublicKey,
    signature: Signature,
    storedNewStorageNumber: Field,
    storedNewStorageSignature: Signature
  ) {
    const storedRoot = this.storageTreeRoot.get();
    this.storageTreeRoot.assertEquals(storedRoot);

    let storedNumber = this.storageNumber.get();
    this.storageNumber.assertEquals(storedNumber);

    let storageServerPublicKey = this.storageServerPublicKey.get();
    this.storageServerPublicKey.assertEquals(storageServerPublicKey);

    const leaf = priorLeafSigner.toFields().concat(priorLeafMessage.toFields());
    const newLeaf = publicKey.toFields().concat(message.toFields());

    signature.verify(publicKey, newLeaf).assertTrue();

    const updates: Update[] = [
      {
        leaf,
        leafIsEmpty: priorLeafIsEmpty,
        newLeaf,
        newLeafIsEmpty: Bool(false),
        leafWitness,
      },
    ];

    const storedNewRoot = OffChainStorage.assertRootUpdateValid(
      storageServerPublicKey,
      storedNumber,
      storedRoot,
      updates,
      storedNewStorageNumber,
      storedNewStorageSignature
    );

    this.storageTreeRoot.set(storedNewRoot);
    this.storageNumber.set(storedNewStorageNumber);
  }
}
