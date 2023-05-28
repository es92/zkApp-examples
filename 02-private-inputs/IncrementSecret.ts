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
  Poseidon,
  Permissions,
} from 'snarkyjs';

export class IncrementSecret extends SmartContract {
  @state(Field) x = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method initState(salt: Field, firstSecret: Field) {
    this.x.set(Poseidon.hash([salt, firstSecret]));
  }

  @method incrementSecret(salt: Field, secret: Field) {
    const x = this.x.get();
    this.x.assertEquals(x);

    Poseidon.hash([salt, secret]).assertEquals(x);
    this.x.set(Poseidon.hash([salt, secret.add(1)]));
  }
}
