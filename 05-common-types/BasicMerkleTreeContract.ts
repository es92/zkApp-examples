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
  MerkleWitness,
} from 'snarkyjs';

class MerkleWitness20 extends MerkleWitness(20) {}

export class BasicMerkleTreeContract extends SmartContract {
  @state(Field) treeRoot = State<Field>();

  @method initState(initialRoot: Field) {
    this.treeRoot.set(initialRoot);
  }

  @method update(
    leafWitness: MerkleWitness20,
    numberBefore: Field,
    incrementAmount: Field
  ) {
    const initialRoot = this.treeRoot.get();
    this.treeRoot.assertEquals(initialRoot);

    incrementAmount.assertLessThan(Field(10));

    // check the initial state matches what we expect
    const rootBefore = leafWitness.calculateRoot(numberBefore);
    rootBefore.assertEquals(initialRoot);

    // compute the root after incrementing
    const rootAfter = leafWitness.calculateRoot(
      numberBefore.add(incrementAmount)
    );

    // set the new root
    this.treeRoot.set(rootAfter);
  }
}
