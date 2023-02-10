import {
  Account,
  Bool,
  Circuit,
  DeployArgs,
  Field,
  Int64,
  isReady,
  method,
  Mina,
  AccountUpdate,
  Permissions,
  PrivateKey,
  PublicKey,
  SmartContract,
  Token,
  UInt64,
  VerificationKey,
  Struct,
  State,
  state,
  UInt32,
} from 'snarkyjs';

import { WrappedMina } from './WrappedMina.js'

export class TokenPool extends SmartContract {
  static wrappedMinaPublicKey: PublicKey;

  deploy(args?: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      // send: Permissions.proof(),
    });
  }

  // ----------------------------------------------------------------------
  
  @method init() {
    super.init();
  }

  // ----------------------------------------------------------------------

  @method moveMinaToWrappedMina(
    amount: UInt64,
  ) {
    this.send({ to: TokenPool.wrappedMinaPublicKey, amount });

    const wrappedMinaContract = new WrappedMina(TokenPool.wrappedMinaPublicKey);
    wrappedMinaContract.mintWrappedMinaWithoutApprove(amount, this.address);
  }

  // ----------------------------------------------------------------------

  @method moveWrappedMinaToMina(
    amount: UInt64,
  ) {
    const wrappedMinaContract = new WrappedMina(TokenPool.wrappedMinaPublicKey);

    // TODO this doesn't work - needs permission to burn?
    wrappedMinaContract.redeemWrappedMinaWithoutApprove(this.address, this.address, amount);
  }

  // ----------------------------------------------------------------------
}
