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

import { WrappedMina } from './WrappedMina.js';

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

  @method moveMinaToWrappedMina(amount: UInt64) {
    this.send({ to: TokenPool.wrappedMinaPublicKey, amount });

    const wrappedMinaContract = new WrappedMina(TokenPool.wrappedMinaPublicKey);
    wrappedMinaContract.mintWrappedMina(amount, this.address);
  }

  // ----------------------------------------------------------------------

  @method moveWrappedMinaToMina(amount: UInt64) {
    const wrappedMinaContract = new WrappedMina(TokenPool.wrappedMinaPublicKey);

    const wminaContract = new WMinaTokenHolder(
      this.address,
      Token.getId(TokenPool.wrappedMinaPublicKey)
    );
    wminaContract.burnWMINA(amount);
    const burnWMINA = wminaContract.self;

    wrappedMinaContract.redeemWrappedMinaApprove(
      burnWMINA,
      amount,
      this.address
    );
  }

  // ----------------------------------------------------------------------
}

export class WMinaTokenHolder extends SmartContract {
  @method burnWMINA(amount: UInt64) {
    this.balance.subInPlace(amount);
  }
}
