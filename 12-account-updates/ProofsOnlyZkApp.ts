import { SecondaryZkApp } from './SecondaryZkApp.js';

import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  PublicKey,
  Permissions,
} from 'snarkyjs';

export class ProofsOnlyZkApp extends SmartContract {
  @state(Field) num = State<Field>();
  @state(Field) calls = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      setDelegate: Permissions.proof(),
      setPermissions: Permissions.proof(),
      setVerificationKey: Permissions.proof(),
      setZkappUri: Permissions.proof(),
      setTokenSymbol: Permissions.proof(),
      incrementNonce: Permissions.proof(),
      setVotingFor: Permissions.proof(),
      setTiming: Permissions.proof(),
    });
  }

  @method init() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertFalse();

    super.init();
    this.num.set(Field(1));
    this.calls.set(Field(0));
  }

  @method add(incrementBy: Field) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const num = this.num.get();
    this.num.assertEquals(num);
    this.num.set(num.add(incrementBy));

    this.incrementCalls();
  }

  @method incrementCalls() {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const calls = this.calls.get();
    this.calls.assertEquals(calls);
    this.calls.set(calls.add(Field(1)));
  }

  @method callSecondary(secondaryAddr: PublicKey) {
    this.account.provedState.assertEquals(this.account.provedState.get());
    this.account.provedState.get().assertTrue();

    const secondaryContract = new SecondaryZkApp(secondaryAddr);

    const num = this.num.get();
    this.num.assertEquals(num);

    secondaryContract.add(num);

    // NOTE this gets the state at the start of the transaction
    this.num.set(secondaryContract.num.get());

    this.incrementCalls();
  }
}
